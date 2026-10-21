import 'server-only';
import { getDb } from '@/lib/db/server';

/** One trivial query, timed. Used by the Settings page to show whether the database answers and how quickly. */
export async function pingDb(): Promise<{ ok: boolean; ms: number }> {
  const t0 = Date.now();
  const { error } = await getDb().from('jobs').select('id').limit(1);
  return { ok: !error, ms: Date.now() - t0 };
}
