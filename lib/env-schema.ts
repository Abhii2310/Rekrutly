import { z } from 'zod';

const PROVIDERS = ['gateway', 'google', 'anthropic'] as const;
export type AiProvider = (typeof PROVIDERS)[number];

const KEY_INFO: Record<AiProvider, { name: string; where: string }> = {
  gateway: { name: 'AI_GATEWAY_API_KEY', where: 'Vercel Dashboard → AI Gateway → API Keys' },
  google: { name: 'GOOGLE_GENERATIVE_AI_API_KEY', where: 'aistudio.google.com → Get API key' },
  anthropic: { name: 'ANTHROPIC_API_KEY', where: 'console.anthropic.com → API keys' },
};

const str = (where: string) => z.string({ error: `is missing. ${where}` }).min(1, `is missing. ${where}`);
const bool = (def: 'true' | 'false') =>
  z.enum(['true', 'false']).default(def).transform((v) => v === 'true');

const schema = z
  .object({
    SUPABASE_URL: str('Supabase → Project Settings → API → Project URL').pipe(z.url()),
    SUPABASE_SERVICE_ROLE_KEY: str('Supabase → Project Settings → API Keys → secret key'),
    AI_PROVIDER: z.enum(PROVIDERS).default('google'),
    AI_FALLBACK_PROVIDER: z.enum(PROVIDERS).optional(),
    AI_GATEWAY_API_KEY: z.string().optional(),
    GOOGLE_GENERATIVE_AI_API_KEY: z.string().optional(),
    ANTHROPIC_API_KEY: z.string().optional(),
    AI_MODEL_SMART: z.string().optional(),
    AI_MODEL_FAST: z.string().optional(),
    AI_FALLBACK_MODEL: z.string().optional(),
    RECRUITER_PASSCODE: str('Choose a passcode you will type on stage'),
    SESSION_SECRET: str('Run: openssl rand -base64 32').min(32, 'must be at least 32 characters. Run: openssl rand -base64 32'),
    TOKEN_ENC_KEY: str('Run: openssl rand -base64 32').refine(
      (v) => Buffer.from(v, 'base64').length === 32,
      'must base64-decode to exactly 32 bytes. Run: openssl rand -base64 32',
    ),
    APP_URL: z.url().default('http://localhost:3000'),
    DEMO_MODE: bool('false'),
    TASK_OVERDUE_MINUTES: z.coerce.number().int().positive().default(60),
    DEMO_CANDIDATE_EMAIL: z.string().optional(),
    DEMO_CANDIDATE_WHATSAPP: z.string().optional(),
    RESEND_API_KEY: z.string().optional(),
    EMAIL_FROM: z.string().default('Rekrutly <onboarding@resend.dev>'),
  })
  .superRefine((v, ctx) => {
    if (v.AI_FALLBACK_PROVIDER && v.AI_FALLBACK_PROVIDER === v.AI_PROVIDER) {
      ctx.addIssue({ code: 'custom', path: ['AI_FALLBACK_PROVIDER'], message: 'must differ from AI_PROVIDER' });
    }
    const used = new Set<AiProvider>([v.AI_PROVIDER]);
    if (v.AI_FALLBACK_PROVIDER) used.add(v.AI_FALLBACK_PROVIDER);
    for (const p of used) {
      const { name, where } = KEY_INFO[p];
      if (!v[name as keyof typeof v]) {
        ctx.addIssue({ code: 'custom', path: [name], message: `is missing (needed because ${p} is in use). ${where}` });
      }
    }
  });

export type Env = z.infer<typeof schema>;
export type ParseEnvResult = { ok: true; data: Env } | { ok: false; message: string };

/** Treat empty strings as unset so `KEY=` in .env.local behaves like a missing variable. */
export function parseEnv(raw: Record<string, string | undefined>): ParseEnvResult {
  const cleaned: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw)) {
    const t = v?.trim();
    if (t) cleaned[k] = t;
  }
  const result = schema.safeParse(cleaned);
  if (result.success) return { ok: true, data: result.data };
  const lines = result.error.issues.map((i) => `  ${i.path.join('.') || 'env'} ${i.message}`);
  return { ok: false, message: `Invalid environment (.env.local):\n${lines.join('\n')}` };
}

export type EmailStatus = 'configured' | 'not_configured' | 'test_sender_without_recipient';

export function emailStatus(env: Pick<Env, 'RESEND_API_KEY' | 'EMAIL_FROM' | 'DEMO_CANDIDATE_EMAIL'>): EmailStatus {
  if (!env.RESEND_API_KEY) return 'not_configured';
  if (env.EMAIL_FROM.includes('resend.dev') && !env.DEMO_CANDIDATE_EMAIL) return 'test_sender_without_recipient';
  return 'configured';
}
