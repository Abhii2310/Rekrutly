import 'server-only';
import { draftFollowUp } from '@/lib/ai/followups';
import { LANGUAGE_NAMES, type Language } from '@/lib/ai/followup-rules';
import type { FollowUpDraft } from '@/lib/ai/schemas';
import { getDb } from '@/lib/db/server';
import { env } from '@/lib/env';
import { logEvent } from '@/lib/events';
import { err, ok, type Result } from '@/lib/result';
import { decryptToken } from '@/lib/security/tokens';
import { formatDate } from '@/lib/format';
import { firstName } from './pipeline';

const USABLE = ['created', 'sent', 'opened'];

/**
 * Writes (or rewrites) the draft for one open follow-up task and saves it on the task. Never sends anything.
 * The candidate's link is read here and added to the text by code; the model only sees a first name, the role,
 * the duration and a date.
 */
export async function createDraftForTask(taskId: string, language: Language): Promise<Result<{ draft: FollowUpDraft; candidateName: string }>> {
  const db = getDb();
  const task = await db.from('tasks').select('id, run_id, job_id, candidate_id, type, status').eq('id', taskId).maybeSingle();
  if (task.error) return err('db_error', "Couldn't load the task.", task.error.message);
  if (!task.data) return err('not_found', 'Task not found.');
  if (task.data.type !== 'follow_up') return err('no_draft', 'Messages are only drafted for follow-ups.');
  if (task.data.status !== 'open') return err('not_open', 'This task is already closed.');
  const { run_id: runId, job_id: jobId, candidate_id: candidateId } = task.data as { run_id: string | null; job_id: string | null; candidate_id: string | null };
  if (!runId || !candidateId) return err('no_candidate', 'This task has no candidate.');

  const [cand, job, assessment] = await Promise.all([
    db.from('candidates').select('full_name').eq('id', candidateId).maybeSingle(),
    jobId ? db.from('jobs').select('title').eq('id', jobId).maybeSingle() : Promise.resolve({ data: null, error: null }),
    db.from('assessments').select('id, duration_minutes').eq('run_id', runId).maybeSingle(),
  ]);
  if (cand.error || !cand.data) return err('db_error', "Couldn't load the candidate.");
  if (assessment.error || !assessment.data) return err('no_assessment', 'This workflow has no assessment yet.');
  const inv = await db.from('invitations').select('status, expires_at, token_encrypted').eq('assessment_id', assessment.data.id).eq('candidate_id', candidateId).maybeSingle();
  if (inv.error || !inv.data) return err('no_invitation', "This candidate doesn't have a link yet.");

  const usable = USABLE.includes(inv.data.status as string);
  const name = cand.data.full_name as string;
  const res = await draftFollowUp({
    firstName: firstName(name),
    role: (job.data?.title as string | undefined) ?? 'open',
    durationMinutes: assessment.data.duration_minutes as number,
    validUntil: usable ? formatDate(inv.data.expires_at as string) : null,
    language,
    link: usable ? `${env.APP_URL}/a/${decryptToken(inv.data.token_encrypted as string)}` : null,
  });
  if (!res.ok) return res;

  const upd = await db.from('tasks').update({ draft: res.data.draft }).eq('id', taskId);
  if (upd.error) return err('db_error', "Couldn't save the draft.", upd.error.message);
  await logEvent({
    runId, jobId, candidateId, type: 'followup.drafted', actor: 'agent', level: 'success',
    message: `Drafted a follow-up for ${firstName(name)} in ${LANGUAGE_NAMES[language]}. Nothing was sent.`,
    data: { taskId, language, ai_provider: res.data.meta.provider, ai_model: res.data.meta.model },
  });
  return ok({ draft: res.data.draft, candidateName: name });
}
