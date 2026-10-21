import 'server-only';
import { groupFilter, type ActivityGroup } from '@/lib/activity';
import { getDb } from '@/lib/db/server';
import { err, ok, type Result } from '@/lib/result';
import type { EventActor, EventLevel } from '@/lib/db/types';

export type ActivityRow = {
  id: number; type: string; actor: EventActor; level: EventLevel; message: string; is_simulated: boolean; created_at: string;
  candidate: string | null; run_id: string | null;
};

const COLUMNS = 'id, type, actor, level, message, is_simulated, created_at, run_id, candidates(full_name)';

type Raw = Omit<ActivityRow, 'candidate'> & { candidates: { full_name: string } | { full_name: string }[] | null };
const shape = (r: Raw): ActivityRow => {
  const { candidates, ...rest } = r;
  const c = Array.isArray(candidates) ? candidates[0] : candidates;
  return { ...rest, candidate: c?.full_name ?? null };
};

/** One page of receipts, newest first. `before` is the id of the last row of the previous page. Fetches one extra row to know if more exist. */
export async function listActivity(group: ActivityGroup, before: number | null, pageSize = 50): Promise<Result<{ rows: ActivityRow[]; hasMore: boolean }>> {
  let q = getDb().from('workflow_events').select(COLUMNS).order('id', { ascending: false }).limit(pageSize + 1);
  const filter = groupFilter(group);
  if (filter) q = q.or(filter);
  if (before !== null) q = q.lt('id', before);
  const { data, error } = await q;
  if (error) return err('db_error', "Couldn't load the activity.", error.message);
  const rows = (data as unknown as Raw[]).map(shape);
  return ok({ rows: rows.slice(0, pageSize), hasMore: rows.length > pageSize });
}

/** Up to `limit` receipts for the CSV export. */
export async function exportActivity(group: ActivityGroup, limit = 5000): Promise<Result<ActivityRow[]>> {
  let q = getDb().from('workflow_events').select(COLUMNS).order('id', { ascending: false }).limit(limit);
  const filter = groupFilter(group);
  if (filter) q = q.or(filter);
  const { data, error } = await q;
  if (error) return err('db_error', "Couldn't export the activity.", error.message);
  return ok((data as unknown as Raw[]).map(shape));
}
