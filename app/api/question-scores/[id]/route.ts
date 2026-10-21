import { z } from 'zod';
import { apiError, apiOk } from '@/lib/api';
import { getDb } from '@/lib/db/server';
import { logEvent } from '@/lib/events';
import { recomputeSubmission } from '@/lib/scoring/pipeline';
import { requireRecruiter } from '@/lib/security/require-recruiter';

const Body = z.object({
  score: z.number({ error: 'Enter a score.' }).min(0, 'The score can not be below 0.'),
  reason: z.string({ error: 'Add a reason.' }).trim().min(3, 'Add a reason of at least 3 characters.').max(500),
});

/** The recruiter's score replaces the suggestion in totals. The original suggestion is kept and shown. */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const denied = await requireRecruiter();
  if (denied) return denied;
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) return apiError('not_found', 'Score not found.', 404);
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return apiError('invalid_input', parsed.error.issues[0]?.message ?? 'Check the score and reason.', 400);
  const { score, reason } = parsed.data;

  const db = getDb();
  const row = await db.from('question_scores').select('id, submission_id, question_id, score, max_score, overridden_score').eq('id', id).maybeSingle();
  if (row.error || !row.data) return apiError('not_found', 'Score not found.', 404);
  const r = row.data as { submission_id: string; question_id: string; score: number; max_score: number; overridden_score: number | null };
  if (score > Number(r.max_score)) return apiError('invalid_input', `The score can not be above ${Number(r.max_score)}.`, 400);

  const rounded = Math.round(score * 100) / 100;
  const upd = await db.from('question_scores').update({ overridden_score: rounded, override_reason: reason, overridden_at: new Date().toISOString() }).eq('id', id);
  if (upd.error) return apiError('db_error', "Couldn't save the override.", 500);
  await recomputeSubmission(r.submission_id);

  const ctx = await db.from('submissions').select('invitations(candidate_id, assessments(run_id, job_id))').eq('id', r.submission_id).maybeSingle();
  const inv = (ctx.data as unknown as { invitations: { candidate_id: string; assessments: { run_id: string | null; job_id: string } | null } } | null)?.invitations;
  await logEvent({
    runId: inv?.assessments?.run_id ?? null, jobId: inv?.assessments?.job_id ?? null, candidateId: inv?.candidate_id ?? null, type: 'score.overridden', actor: 'recruiter',
    message: `Changed a score from ${r.overridden_score ?? Number(r.score)} to ${rounded}`,
    data: { questionId: r.question_id, old: r.overridden_score ?? Number(r.score), new: rounded, reason },
  });
  return apiOk({ id, overridden_score: rounded });
}
