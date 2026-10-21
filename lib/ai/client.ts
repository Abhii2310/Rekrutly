import 'server-only';
import { createGateway, generateText, Output, type LanguageModel } from 'ai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createAnthropic } from '@ai-sdk/anthropic';
import type { z } from 'zod';
import { env } from '@/lib/env';
import type { AiProvider } from '@/lib/env-schema';
import { err, ok, type Result } from '@/lib/result';
import { buildAttempts, runAttempts, type Attempt, type AiMeta, type ModelConfig, type Tier } from './attempts';
import { classifyError } from './errors';

export type { AiMeta, Tier } from './attempts';

const config: ModelConfig = {
  provider: env.AI_PROVIDER,
  fallbackProvider: env.AI_FALLBACK_PROVIDER,
  smart: env.AI_MODEL_SMART,
  fast: env.AI_MODEL_FAST,
  fallbackModel: env.AI_FALLBACK_MODEL,
};

/** The only place a provider package is used: builds gateway(id) / google(id) / anthropic(id). */
function build(provider: AiProvider, id: string): LanguageModel {
  if (provider === 'google') return createGoogleGenerativeAI({ apiKey: env.GOOGLE_GENERATIVE_AI_API_KEY })(id);
  if (provider === 'anthropic') return createAnthropic({ apiKey: env.ANTHROPIC_API_KEY })(id);
  return createGateway({ apiKey: env.AI_GATEWAY_API_KEY })(id);
}

export function getModel(tier: Tier, provider: AiProvider = env.AI_PROVIDER): Result<{ model: LanguageModel; provider: AiProvider; modelId: string }> {
  const modelId = provider === env.AI_PROVIDER ? (tier === 'smart' ? env.AI_MODEL_SMART : env.AI_MODEL_FAST) : env.AI_FALLBACK_MODEL;
  if (!modelId) return err('ai_not_configured', `No ${tier} model is set for ${provider}. Run npm run ai:check.`);
  return ok({ model: build(provider, modelId), provider, modelId });
}

export type StructuredInput<S extends z.ZodType> = {
  tier: Tier;
  system: string;
  prompt: string;
  schema: S;
  temperature?: number;
  /** Gemini reasoning effort. Low keeps planning and grading fast; raise it only where quality needs it. */
  thinking?: 'minimal' | 'low' | 'medium' | 'high';
  /** Per-attempt cap. The whole call also stays inside a 55s budget. */
  timeoutMs?: number;
};

/**
 * Structured output with the retry policy from ARCHITECTURE section 4. Never throws.
 * Errors carry an AiError code (timeout | invalid_output | provider_error) in `error.code`.
 * Logs duration and token counts, never prompt contents.
 */
export async function runStructured<S extends z.ZodType>(input: StructuredInput<S>): Promise<Result<{ output: z.infer<S>; meta: AiMeta }>> {
  const attempts = buildAttempts(config, input.tier);
  if (!attempts.ok) return attempts;

  const call = async (a: Attempt, remaining: number) => {
    const t0 = Date.now();
    try {
      const res = await generateText({
        model: build(a.provider, a.modelId),
        output: Output.object({ schema: input.schema }),
        system: input.system,
        prompt: input.prompt,
        temperature: input.temperature,
        maxRetries: 0, // our own policy handles retries
        ...(a.provider === 'google' ? { providerOptions: { google: { thinkingConfig: { thinkingLevel: input.thinking ?? 'low' } } } } : {}),
        abortSignal: AbortSignal.timeout(Math.min(input.timeoutMs ?? 45_000, remaining)),
      });
      console.log(`[ai] ${a.provider}/${a.modelId} ${a.label} ok ${Date.now() - t0}ms tokens=${res.usage?.totalTokens ?? '?'}`);
      return { ok: true as const, value: res.output as z.infer<S> };
    } catch (e) {
      const error = classifyError(e);
      console.warn(`[ai] ${a.provider}/${a.modelId} ${a.label} ${error.code}${error.status ? ` ${error.status}` : ''} ${Date.now() - t0}ms`);
      return { ok: false as const, error };
    }
  };

  const { result } = await runAttempts(attempts.data, call, {
    sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
    now: Date.now,
    budgetMs: 55_000,
  });
  if (!result.ok) return result;
  return ok({ output: result.data.value, meta: result.data.meta });
}
