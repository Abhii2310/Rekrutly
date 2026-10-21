import { z } from 'zod';
import { apiError, apiOk } from '@/lib/api';
import { getDb } from '@/lib/db/server';
import { logEvent } from '@/lib/events';
import { requireRecruiter } from '@/lib/security/require-recruiter';

/** The first time a recruiter opens a submission, the candidate moves to "In review". Later opens do nothing. */
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const denied = await requireRecruiter();
  if (denied) return denied;
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) return apiError('not_found', 'Submission not found.', 404);

  const db = getDb();
  const s = await db.from('submissions').select('invitations(candidate_id, assessments(run_id, job_id), candidates(full_name))').eq('id', id).maybeSingle();
  if (s.error || !s.data) return apiError('not_found', 'Submission not found.', 404);
  type J = { candidate_id: string; assessments: { run_id: string | null; job_id: string } | null; candidates: { full_name: string } | null };
  const inv = (s.data as unknown as { invitations: J }).invitations;

  const moved = await db.from('candidates').update({ stage: 'under_review' }).eq('id', inv.candidate_id).eq('stage', 'assessment_submitted').select('id');
  if (moved.data && moved.data.length > 0) {
    await logEvent({
      runId: inv.assessments?.run_id ?? null, jobId: inv.assessments?.job_id ?? null, candidateId: inv.candidate_id, type: 'candidate.review_started', actor: 'recruiter',
      message: `Started reviewing ${inv.candidates?.full_name ?? 'a candidate'}`,
    });
  }
  return apiOk({ moved: Boolean(moved.data && moved.data.length > 0) });
}
