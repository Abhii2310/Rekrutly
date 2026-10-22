import 'server-only';
import { z } from 'zod';
import { apiError, apiOk, withErrors } from '@/lib/api';
import { getDb } from '@/lib/db/server';
import { logEvent } from '@/lib/events';
import { requireRecruiter } from '@/lib/security/require-recruiter';

/** The recruiter's own decision to shortlist or un-shortlist. Never set by a score or by the AI. */
async function handlePOST(request: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const denied = await requireRecruiter();
  if (denied) return denied;
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) return apiError('not_found', 'Candidate not found.', 404);
  const body = z.object({ shortlisted: z.boolean() }).safeParse(await request.json().catch(() => null));
  if (!body.success) return apiError('invalid_input', 'Say whether to shortlist.', 400);

  const db = getDb();
  const cand = await db.from('candidates').select('id, job_id, full_name').eq('id', id).maybeSingle();
  if (cand.error) return apiError('db_error', "Couldn't load the candidate.", 500);
  if (!cand.data) return apiError('not_found', 'Candidate not found.', 404);
  const up = await db.from('candidates').update({ shortlisted: body.data.shortlisted }).eq('id', id);
  if (up.error) return apiError('db_error', "Couldn't save that.", 500);
  await logEvent({
    jobId: cand.data.job_id as string, candidateId: id, type: 'candidate.shortlisted', actor: 'recruiter', level: 'info',
    message: `${body.data.shortlisted ? 'Shortlisted' : 'Removed from the shortlist:'} ${cand.data.full_name as string}`.replace(':', ''),
  });
  return apiOk({ shortlisted: body.data.shortlisted });
}

export const POST = withErrors(handlePOST);
