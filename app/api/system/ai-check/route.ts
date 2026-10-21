import 'server-only';
import { z } from 'zod';
import { withErrors, apiOk } from '@/lib/api';
import { runStructured, type Tier } from '@/lib/ai/client';
import { requireRecruiter } from '@/lib/security/require-recruiter';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

const Pong = z.object({ ok: z.boolean() });

/** A tiny real call on each model tier, so you can see which provider answers and how fast. Sends no personal data. */
async function handlePOST(): Promise<Response> {
  const denied = await requireRecruiter();
  if (denied) return denied;
  const tiers: Tier[] = ['smart', 'fast'];
  const results = await Promise.all(tiers.map(async (tier) => {
    const res = await runStructured({ tier, system: 'You answer with the schema only.', prompt: 'Return ok true.', schema: Pong, temperature: 0, thinking: 'low', timeoutMs: 25_000 });
    return res.ok
      ? { tier, ok: true as const, provider: res.data.meta.provider, model: res.data.meta.model, ms: res.data.meta.durationMs, fellBack: res.data.meta.fellBack }
      : { tier, ok: false as const, error: res.error.message.slice(0, 160) };
  }));
  return apiOk({ results });
}

export const POST = withErrors(handlePOST);
