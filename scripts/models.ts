import type { AiProvider, Env } from '../lib/env-schema';

export type LiveModels = { provider: AiProvider; ids: string[] };

function keyFor(env: Env, p: AiProvider): string {
  const key = { gateway: env.AI_GATEWAY_API_KEY, google: env.GOOGLE_GENERATIVE_AI_API_KEY, anthropic: env.ANTHROPIC_API_KEY, groq: env.GROQ_API_KEY, openrouter: env.OPENROUTER_API_KEY }[p];
  return key ?? '';
}

async function getJson(url: string, headers: Record<string, string>): Promise<unknown> {
  const res = await fetch(url, { headers });
  const body = await res.text();
  if (!res.ok) throw new Error(`HTTP ${res.status} from ${new URL(url).host}: ${body.slice(0, 300)}`);
  return JSON.parse(body);
}

/** Live text-model IDs for one provider. Never returns invented IDs. */
export async function listModels(env: Env, provider: AiProvider): Promise<LiveModels> {
  const key = keyFor(env, provider);
  if (provider === 'google') {
    const j = (await getJson('https://generativelanguage.googleapis.com/v1beta/models?pageSize=200', { 'x-goog-api-key': key })) as {
      models?: { name: string; supportedGenerationMethods?: string[] }[];
    };
    const ids = (j.models ?? [])
      .filter((m) => m.supportedGenerationMethods?.includes('generateContent'))
      .map((m) => m.name.replace(/^models\//, ''))
      .filter((id) => id.startsWith('gemini-'));
    return { provider, ids };
  }
  if (provider === 'gateway') {
    const j = (await getJson('https://ai-gateway.vercel.sh/v1/models', { Authorization: `Bearer ${key}` })) as {
      data?: { id: string; type?: string }[];
    };
    return { provider, ids: (j.data ?? []).filter((m) => !m.type || m.type === 'language').map((m) => m.id) };
  }
  if (provider === 'groq') {
    const j = (await getJson('https://api.groq.com/openai/v1/models', { Authorization: `Bearer ${key}` })) as { data?: { id: string; active?: boolean }[] };
    // Chat models only: no speech, audio or safety-classifier models.
    const ids = (j.data ?? []).filter((m) => m.active !== false).map((m) => m.id).filter((id) => !/whisper|orpheus|guard|safeguard|allam/i.test(id));
    return { provider, ids };
  }
  const j = (await getJson('https://api.anthropic.com/v1/models?limit=100', { 'x-api-key': key, 'anthropic-version': '2023-06-01' })) as {
    data?: { id: string }[];
  };
  return { provider, ids: (j.data ?? []).map((m) => m.id) };
}

const version = (id: string): number[] => (id.match(/\d+(?:\.\d+)?/g) ?? []).flatMap((n) => n.split('.').map(Number));
const newestFirst = (a: string, b: string): number => {
  const [va, vb] = [version(a), version(b)];
  for (let i = 0; i < Math.max(va.length, vb.length); i++) {
    const d = (vb[i] ?? 0) - (va[i] ?? 0);
    if (d !== 0) return d;
  }
  return 0;
};

/** Pick smart and fast model IDs from a live list (stable models only for google). */
export function pickModels({ provider, ids }: LiveModels): { smart?: string; fast?: string } {
  if (provider === 'google') {
    const flash = ids.filter((i) => /^gemini-[\d.]+-flash$/.test(i)).sort(newestFirst);
    const lite = ids.filter((i) => /^gemini-[\d.]+-flash-lite$/.test(i)).sort(newestFirst);
    return { smart: flash[0], fast: lite[0] ?? flash[0] };
  }
  if (provider === 'groq') {
    const big = ids.find((i) => /gpt-oss-120b/.test(i)) ?? ids.find((i) => /70b|27b/.test(i));
    const small = ids.find((i) => /gpt-oss-20b/.test(i)) ?? ids.find((i) => /8b|20b/.test(i)) ?? big;
    return { smart: big, fast: small };
  }
  const sonnet = ids.filter((i) => /claude-sonnet/.test(i)).sort(newestFirst);
  const haiku = ids.filter((i) => /claude-haiku/.test(i)).sort(newestFirst);
  return { smart: sonnet[0], fast: haiku[0] };
}
