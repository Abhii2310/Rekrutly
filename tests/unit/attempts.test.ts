import { describe, expect, it } from 'vitest';
import { buildAttempts, runAttempts, type Attempt, type CallResult } from '@/lib/ai/attempts';
import { classifyError } from '@/lib/ai/errors';

const cfg = { provider: 'google', smart: 'smart-1', fast: 'fast-1' } as const;

function deps(budgetMs = 55_000) {
  const sleeps: number[] = [];
  let t = 0;
  return { sleeps, deps: { sleep: async (ms: number) => { sleeps.push(ms); t += ms; }, now: () => (t += 10), budgetMs } };
}

describe('buildAttempts', () => {
  it('is smart, then the same provider fast model', () => {
    const r = buildAttempts(cfg, 'smart');
    expect(r.ok && r.data.map((a) => `${a.provider}/${a.modelId}`)).toEqual(['google/smart-1', 'google/fast-1']);
  });
  it('adds the fallback provider last', () => {
    const r = buildAttempts({ ...cfg, fallbackProvider: 'anthropic', fallbackModel: 'claude-x' }, 'smart');
    expect(r.ok && r.data.map((a) => a.label)).toEqual(['primary', 'retry-fast', 'fallback-provider']);
  });
  it('names the missing model variable', () => {
    const r = buildAttempts({ provider: 'google' }, 'smart');
    expect(!r.ok && r.error.message).toMatch(/AI_MODEL_SMART/);
  });
});

describe('runAttempts', () => {
  const attempts = (buildAttempts({ ...cfg, fallbackProvider: 'anthropic', fallbackModel: 'claude-x' }, 'smart') as { ok: true; data: Attempt[] }).data;
  const fail = (code: 'timeout' | 'provider_error' | 'invalid_output', status?: number): CallResult<string> => ({ ok: false, error: { code, message: code, status } });

  it('returns the first success without retrying', async () => {
    const { deps: d } = deps();
    let calls = 0;
    const { result } = await runAttempts(attempts, async () => { calls++; return { ok: true, value: 'x' }; }, d);
    expect(calls).toBe(1);
    expect(result.ok && result.data.meta.model).toBe('smart-1');
  });

  it('retries on the fast model after a timeout, then reports which model answered', async () => {
    const { deps: d } = deps();
    const { result } = await runAttempts(attempts, async (a) => (a.label === 'primary' ? fail('timeout') : { ok: true, value: 'x' }), d);
    expect(result.ok && result.data.meta).toMatchObject({ model: 'fast-1', attempts: 2, fellBack: false });
  });

  it('falls back to the other provider after provider errors', async () => {
    const { deps: d } = deps();
    const { result } = await runAttempts(attempts, async (a) => (a.label === 'fallback-provider' ? { ok: true, value: 'x' } : fail('provider_error', 500)), d);
    expect(result.ok && result.data.meta).toMatchObject({ provider: 'anthropic', fellBack: true });
  });

  it('skips the fallback provider after invalid output', async () => {
    const { deps: d } = deps();
    const seen: string[] = [];
    const { result } = await runAttempts(attempts, async (a) => { seen.push(a.label); return fail('invalid_output'); }, d);
    expect(seen).toEqual(['primary', 'retry-fast']);
    expect(!result.ok && result.error.code).toBe('invalid_output');
  });

  it('backs off 2s then 5s on HTTP 429 before moving on', async () => {
    const { deps: d, sleeps } = deps();
    let n = 0;
    const { result } = await runAttempts(attempts.slice(0, 1), async () => (++n < 3 ? fail('provider_error', 429) : { ok: true, value: 'x' }), d);
    expect(sleeps).toEqual([2000, 5000]);
    expect(result.ok).toBe(true);
  });

  it('gives up on a third 429 in a row', async () => {
    const { deps: d, sleeps } = deps();
    const { result } = await runAttempts(attempts.slice(0, 1), async () => fail('provider_error', 429), d);
    expect(sleeps).toEqual([2000, 5000]);
    expect(!result.ok && result.error.code).toBe('provider_error');
  });

  it('stops when the time budget is spent', async () => {
    const { deps: d } = deps(1000);
    let calls = 0;
    const { result } = await runAttempts(attempts, async () => { calls++; return fail('timeout'); }, d);
    expect(calls).toBe(0);
    expect(!result.ok && result.error.code).toBe('timeout');
  });
});

describe('classifyError', () => {
  it('maps a timeout abort to timeout', () => {
    const e = new Error('x'); e.name = 'TimeoutError';
    expect(classifyError(e).code).toBe('timeout');
  });
  it('maps unknown errors to provider_error and never leaks key-like strings', () => {
    const r = classifyError(new Error('bad key AQ.abcdefghijklmnop'));
    expect(r.code).toBe('provider_error');
    expect(r.message).not.toMatch(/AQ\.abc/);
  });
});
