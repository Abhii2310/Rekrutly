// Exception to "no provider imports outside lib/ai/client.ts": this standalone script
// runs before lib/ai/client.ts exists (Prompt 05) and cannot import server-only modules.
import { createGateway } from 'ai';
import { generateText, Output, type LanguageModel } from 'ai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createGroq } from '@ai-sdk/groq';
import { z } from 'zod';
import { loadEnv } from './db';
import { listModels, pickModels } from './models';
import type { AiProvider, Env } from '../lib/env-schema';

function build(env: Env, provider: AiProvider, id: string): LanguageModel {
  if (provider === 'google') return createGoogleGenerativeAI({ apiKey: env.GOOGLE_GENERATIVE_AI_API_KEY })(id);
  if (provider === 'anthropic') return createAnthropic({ apiKey: env.ANTHROPIC_API_KEY })(id);
  if (provider === 'groq') return createGroq({ apiKey: env.GROQ_API_KEY })(id);
  return createGateway({ apiKey: env.AI_GATEWAY_API_KEY })(id);
}

async function tryModel(env: Env, label: string, provider: AiProvider, id: string): Promise<boolean> {
  const t0 = Date.now();
  try {
    const { output } = await generateText({
      model: build(env, provider, id),
      output: Output.object({ schema: z.object({ ok: z.boolean() }) }),
      prompt: 'Return ok = true.',
      abortSignal: AbortSignal.timeout(90_000),
    });
    console.log(`OK    ${label.padEnd(8)} ${provider}/${id}  ok=${output.ok}  ${Date.now() - t0}ms`);
    return true;
  } catch (e) {
    console.error(`FAIL  ${label.padEnd(8)} ${provider}/${id}  ${Date.now() - t0}ms\n      ${(e as Error).message}`);
    return false;
  }
}

async function main(): Promise<void> {
  const env = loadEnv();
  let smart = env.AI_MODEL_SMART;
  let fast = env.AI_MODEL_FAST;
  if (!smart || !fast) {
    const picked = pickModels(await listModels(env, env.AI_PROVIDER));
    smart ??= picked.smart;
    fast ??= picked.fast;
    console.log(`Model vars empty: chose from the live list. Put in .env.local: AI_MODEL_SMART=${smart} AI_MODEL_FAST=${fast}`);
  }
  if (!smart || !fast) {
    console.error('Could not choose models from the live list. Run npm run ai:models and set them by hand.');
    process.exit(1);
  }
  const results = [
    await tryModel(env, 'smart', env.AI_PROVIDER, smart),
    await tryModel(env, 'fast', env.AI_PROVIDER, fast),
  ];
  if (env.AI_FALLBACK_PROVIDER && env.AI_FALLBACK_MODEL) {
    results.push(await tryModel(env, 'fallback', env.AI_FALLBACK_PROVIDER, env.AI_FALLBACK_MODEL));
  }
  if (results.includes(false)) process.exit(1);
}

void main();
