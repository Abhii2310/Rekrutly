import 'server-only';
import { z } from 'zod';
import { apiError, apiOk, withErrors } from '@/lib/api';
import { MAX_IMPORT_BYTES, parseCandidateCsv } from '@/lib/candidates/import';
import { getDb } from '@/lib/db/server';
import { logEvent } from '@/lib/events';
import { requireRecruiter } from '@/lib/security/require-recruiter';

const Body = z.object({ csv: z.string({ error: 'Paste or upload a CSV first.' }).min(1, 'Paste or upload a CSV first.').max(MAX_IMPORT_BYTES * 2) });

/** Adds candidates to a job from CSV text. Good rows are saved, bad rows are reported with the reason. Nothing is sent to anyone. */
async function handlePOST(request: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const denied = await requireRecruiter();
  if (denied) return denied;
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) return apiError('not_found', 'Job not found.', 404);
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return apiError('invalid_input', parsed.error.issues[0]?.message ?? 'Paste or upload a CSV first.', 400);

  const db = getDb();
  const [job, existing] = await Promise.all([
    db.from('jobs').select('id, title').eq('id', id).maybeSingle(),
    db.from('candidates').select('email, full_name').eq('job_id', id),
  ]);
  if (job.error || existing.error) return apiError('db_error', "Couldn't load the job.", 500);
  if (!job.data) return apiError('not_found', 'Job not found.', 404);

  const have = existing.data as { email: string | null; full_name: string }[];
  const result = parseCandidateCsv(
    parsed.data.csv,
    new Set(have.filter((r) => r.email).map((r) => (r.email as string).toLowerCase())),
    new Set(have.filter((r) => !r.email).map((r) => r.full_name.toLowerCase())),
  );
  if (result.error) return apiError('invalid_file', result.error, 400);
  if (result.rows.length > 0) {
    const ins = await db.from('candidates').insert(result.rows.map((r) => ({ ...r, job_id: id, source: 'CSV import', stage: 'applied', resume_summary: '', is_demo: false })));
    if (ins.error) {
      console.error('candidate import failed:', ins.error.message);
      return apiError('db_error', "Couldn't save the candidates. Nothing was imported.", 500);
    }
    await logEvent({
      jobId: id, type: 'candidate.imported', actor: 'recruiter', level: 'success',
      message: `Imported ${result.rows.length} ${result.rows.length === 1 ? 'candidate' : 'candidates'} into ${job.data.title as string}${result.skipped.length ? `, skipped ${result.skipped.length}` : ''}`,
      data: { created: result.rows.length, skipped: result.skipped.length },
    });
  }
  return apiOk({ created: result.rows.length, skipped: result.skipped });
}

export const POST = withErrors(handlePOST);
