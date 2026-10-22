import 'server-only';
import { z } from 'zod';
import { apiError, apiOk, withErrors } from '@/lib/api';
import { scoreCandidateResume } from '@/lib/ats/service';
import { getDb } from '@/lib/db/server';
import { requireRecruiter } from '@/lib/security/require-recruiter';

export const maxDuration = 60;
const BATCH = 6;

/**
 * Scores resumes that have not been scored yet, a few per call so no request runs long. The page calls this again until
 * `remaining` is 0. Each score is a suggestion; nobody is shortlisted or moved.
 */
async function handlePOST(_request: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const denied = await requireRecruiter();
  if (denied) return denied;
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) return apiError('not_found', 'Job not found.', 404);
  const todo = await getDb().from('candidates').select('id').eq('job_id', id).not('resume_text', 'is', null).is('resume_match', null).order('created_at');
  if (todo.error) return apiError('db_error', "Couldn't load the resumes.", 500);
  const ids = (todo.data as { id: string }[]).map((c) => c.id);
  const now = ids.slice(0, BATCH);
  const done = await Promise.all(now.map((c) => scoreCandidateResume(c)));
  const scored = done.filter((r) => r.ok).length;
  return apiOk({ scored, failed: now.length - scored, remaining: Math.max(0, ids.length - scored) });
}

export const POST = withErrors(handlePOST);
