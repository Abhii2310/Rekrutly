import { err, ok, type Result } from '@/lib/result';
import type { AiProvider } from '@/lib/env-schema';
import type { AiError } from './errors';

export type Tier = 'smart' | 'fast';

export type ModelConfig = {
  provider: AiProvider;
  fallbackProvider?: AiProvider;
  smart?: string;
  fast?: string;
  fallbackModel?: string;
};

export type Attempt = { provider: AiProvider; modelId: string; label: 'primary' | 'retry-fast' | 'fallback-provider' };

export type AiMeta = { provider: AiProvider; model: string; attempts: number; fellBack: boolean; durationMs: number };

export const AI_ERROR_STATUS: Record<AiError['code'], number> = { timeout: 504, invalid_output: 502, provider_error: 502, guardrail: 422 };

/**
 * The ordered list of tries for one call (ARCHITECTURE section 4):
 * the requested tier, then the same provider's fast model, then the fallback provider if one is set.
 */
export function buildAttempts(cfg: ModelConfig, tier: Tier): Result<Attempt[]> {
  const first = tier === 'smart' ? cfg.smart : cfg.fast;
  if (!first) {
    const name = tier === 'smart' ? 'AI_MODEL_SMART' : 'AI_MODEL_FAST';
    return err('ai_not_configured', `${name} isn't set. Run npm run ai:check, then add the model ID to .env.local.`);
  }
  const attempts: Attempt[] = [{ provider: cfg.provider, modelId: first, label: 'primary' }];
  // The second try uses the other tier's model, so one overloaded model does not fail both tries.
  const second = tier === 'smart' ? cfg.fast : (cfg.smart && cfg.smart !== first ? cfg.smart : cfg.fast);
  if (second) attempts.push({ provider: cfg.provider, modelId: second, label: 'retry-fast' });
  if (cfg.fallbackProvider && cfg.fallbackModel) {
    attempts.push({ provider: cfg.fallbackProvider, modelId: cfg.fallbackModel, label: 'fallback-provider' });
  }
  return ok(attempts);
}

export type RunDeps = {
  sleep: (ms: number) => Promise<void>;
  now: () => number;
  /** Total wall-clock budget across all attempts (route handlers allow 60s). */
  budgetMs: number;
};

export type CallResult<T> = { ok: true; value: T } | { ok: false; error: AiError };

const BACKOFF_MS = [2000, 5000];
const MIN_ATTEMPT_MS = 3000;

/** Runs the attempts in order. `call` gets the attempt and the time it may use, and must not throw. */
export async function runAttempts<T>(
  attempts: Attempt[],
  call: (attempt: Attempt, timeoutMs: number) => Promise<CallResult<T>>,
  deps: RunDeps,
): Promise<{ result: Result<{ value: T; meta: AiMeta }>; lastError?: AiError }> {
  const start = deps.now();
  let last: AiError | undefined;
  let tried = 0;

  for (const attempt of attempts) {
    // A malformed answer will not be fixed by another provider; only a same-provider retry is worth it.
    if (attempt.label === 'fallback-provider' && last?.code === 'invalid_output') continue;

    let rateLimitRetries = 0;
    for (;;) {
      const remaining = deps.budgetMs - (deps.now() - start);
      if (remaining < MIN_ATTEMPT_MS) break;
      tried++;
      const r = await call(attempt, remaining);
      if (r.ok) {
        return {
          result: ok({
            value: r.value,
            meta: {
              provider: attempt.provider, model: attempt.modelId, attempts: tried,
              fellBack: attempt.label === 'fallback-provider', durationMs: deps.now() - start,
            },
          }),
        };
      }
      last = r.error;
      const backoff = BACKOFF_MS[rateLimitRetries];
      // A skipped call never reached the provider, so there is nothing to wait for.
      if (r.error.status === 429 && !r.error.skipped && !r.error.quota && backoff !== undefined) {
        rateLimitRetries++;
        await deps.sleep(backoff);
        continue;
      }
      break;
    }
  }

  const error: AiError = last ?? { code: 'timeout', message: 'The AI took too long to answer.' };
  return { result: err(error.code, error.message, { status: error.status }), lastError: error };
}

/**
 * How long to leave a model alone after it fails, so the next request goes straight to a model that works instead of waiting
 * on a broken one. A used-up quota stays off for as long as the provider said (up to six hours); overload and slowness for
 * a few minutes.
 */
export function cooldownFor(error: { code: string; status?: number; quota?: boolean; retryAfterSec?: number }): number {
  if (error.quota) return Math.min(Math.max((error.retryAfterSec ?? 3600) * 1000, 60_000), 6 * 3_600_000);
  if (error.status === 429) return 90_000;
  if (error.status !== undefined && error.status >= 500) return 180_000;
  if (error.code === 'timeout') return 60_000;
  return 0;
}
