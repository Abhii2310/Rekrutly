import { after } from 'next/server';
import { z } from 'zod';
import { apiError, apiOk } from '@/lib/api';
import { getDb } from '@/lib/db/server';
import { runPostSubmitPipeline } from '@/lib/scoring/pipeline';
import { requireRecruiter } from '@/lib/security/require-recruiter';

export const maxDuration = 60;
const STALE_MS = 2 * 60_000;

/** Re-runs whatever failed or never finished. Already graded questions and a ready report are left alone. */
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const denied = await requireRecruiter();
  if (denied) return denied;
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) return apiError('not_found', 'Submission not found.', 404);

  const db = getDb();
  const s = await db.from('submissions').select('id, scoring_status, report_status, updated_at').eq('id', id).maybeSingle();
  if (s.error || !s.data) return apiError('not_found', 'Submission not found.', 404);
  const row = s.data as { scoring_status: string; report_status: string; updated_at: string };

  // A run that died mid-way leaves the status stuck on "scoring" or "generating"; after two minutes treat it as failed.
  const stale = Date.now() - new Date(row.updated_at).getTime() > STALE_MS;
  if (stale && row.scoring_status === 'scoring') await db.from('submissions').update({ scoring_status: 'failed', scoring_error: 'The earlier attempt did not finish.' }).eq('id', id);
  if (stale && row.report_status === 'generating') await db.from('submissions').update({ report_status: 'failed', report_error: 'The earlier attempt did not finish.' }).eq('id', id);

  if (row.scoring_status === 'scored' && row.report_status === 'ready') return apiOk({ status: 'ready' });
  if (!stale && (row.scoring_status === 'scoring' || row.report_status === 'generating')) return apiOk({ status: 'scoring' });

  after(async () => { await runPostSubmitPipeline(id); });
  return apiOk({ status: 'scoring' });
}
