import { describe, expect, it } from 'vitest';
import { emailStatus, parseEnv } from '@/lib/env-schema';

const key32 = Buffer.alloc(32, 7).toString('base64');
const base = {
  SUPABASE_URL: 'https://abc.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY: 'sb_secret_x',
  GOOGLE_GENERATIVE_AI_API_KEY: 'AQ.fake-key',
  RECRUITER_PASSCODE: 'pass1234',
  SESSION_SECRET: 'x'.repeat(40),
  TOKEN_ENC_KEY: key32,
};

function ok(raw: Record<string, string | undefined>) {
  const r = parseEnv(raw);
  if (!r.ok) throw new Error(r.message);
  return r.data;
}

describe('parseEnv', () => {
  it('passes with a valid env and applies defaults', () => {
    const e = ok(base);
    expect(e.AI_PROVIDER).toBe('google');
    expect(e.TASK_OVERDUE_MINUTES).toBe(60);
    expect(e.APP_URL).toBe('http://localhost:3000');
    expect(e.DEMO_MODE).toBe(false);
    expect(e.AI_MODEL_SMART).toBeUndefined();
  });

  it('fails with a message naming the missing variable and where to get it', () => {
    const r = parseEnv({ ...base, SUPABASE_URL: undefined });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.message).toMatch(/SUPABASE_URL.*Project URL/);
  });

  it('rejects a TOKEN_ENC_KEY that is not 32 bytes', () => {
    const r = parseEnv({ ...base, TOKEN_ENC_KEY: Buffer.alloc(16).toString('base64') });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.message).toMatch(/TOKEN_ENC_KEY.*32 bytes/);
  });

  it('parses DEMO_MODE "false" as false and "true" as true', () => {
    expect(ok({ ...base, DEMO_MODE: 'false' }).DEMO_MODE).toBe(false);
    expect(ok({ ...base, DEMO_MODE: 'true' }).DEMO_MODE).toBe(true);
    expect(parseEnv({ ...base, DEMO_MODE: 'yes' }).ok).toBe(false);
  });

  it('treats empty strings as unset', () => {
    const e = ok({ ...base, DEMO_CANDIDATE_EMAIL: '', TASK_OVERDUE_MINUTES: '', APP_URL: '', AI_FALLBACK_PROVIDER: '' });
    expect(e.DEMO_CANDIDATE_EMAIL).toBeUndefined();
    expect(e.TASK_OVERDUE_MINUTES).toBe(60);
    expect(e.APP_URL).toBe('http://localhost:3000');
    expect(e.AI_FALLBACK_PROVIDER).toBeUndefined();
    expect(parseEnv({ ...base, SESSION_SECRET: '' }).ok).toBe(false);
  });

  it('rejects non-positive TASK_OVERDUE_MINUTES', () => {
    expect(parseEnv({ ...base, TASK_OVERDUE_MINUTES: '0' }).ok).toBe(false);
    expect(parseEnv({ ...base, TASK_OVERDUE_MINUTES: '-5' }).ok).toBe(false);
    expect(ok({ ...base, TASK_OVERDUE_MINUTES: '2' }).TASK_OVERDUE_MINUTES).toBe(2);
  });

  it('requires only the keys for providers in use', () => {
    const noGoogle = { ...base, GOOGLE_GENERATIVE_AI_API_KEY: undefined };
    const r = parseEnv(noGoogle);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.message).toMatch(/GOOGLE_GENERATIVE_AI_API_KEY.*aistudio/);
    expect(parseEnv({ ...noGoogle, AI_PROVIDER: 'anthropic' }).ok).toBe(false);
    expect(ok({ ...noGoogle, AI_PROVIDER: 'anthropic', ANTHROPIC_API_KEY: 'k' }).AI_PROVIDER).toBe('anthropic');
  });

  it('accepts any non-empty Google key (AQ. format)', () => {
    expect(parseEnv({ ...base, GOOGLE_GENERATIVE_AI_API_KEY: 'AQ.anything' }).ok).toBe(true);
  });

  it('requires the fallback provider key and a different provider', () => {
    expect(parseEnv({ ...base, AI_FALLBACK_PROVIDER: 'google' }).ok).toBe(false);
    expect(parseEnv({ ...base, AI_FALLBACK_PROVIDER: 'anthropic' }).ok).toBe(false);
    expect(ok({ ...base, AI_FALLBACK_PROVIDER: 'anthropic', ANTHROPIC_API_KEY: 'k' }).AI_FALLBACK_PROVIDER).toBe('anthropic');
  });
});

describe('emailStatus', () => {
  const e = { RESEND_API_KEY: 'k', EMAIL_FROM: 'Rekrutly <onboarding@resend.dev>', DEMO_CANDIDATE_EMAIL: undefined };
  it('is not_configured without a key', () => {
    expect(emailStatus({ ...e, RESEND_API_KEY: undefined })).toBe('not_configured');
  });
  it('flags the test sender without a recipient', () => {
    expect(emailStatus(e)).toBe('test_sender_without_recipient');
  });
  it('is configured with a recipient or a custom sender', () => {
    expect(emailStatus({ ...e, DEMO_CANDIDATE_EMAIL: 'me@x.com' })).toBe('configured');
    expect(emailStatus({ ...e, EMAIL_FROM: 'Rekrutly <hi@rekrutly.app>' })).toBe('configured');
  });
});
