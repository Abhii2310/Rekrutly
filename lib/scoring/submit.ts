import 'server-only';
import { sendSubmissionEmail } from '@/lib/executor/submission-email';
import { getDb } from '@/lib/db/server';
import { logEvent } from '@/lib/events';
import { updateTrackStep } from '@/lib/portal/progress';
import type { ResolvedInvitation } from '@/lib/portal/service';
import { err, ok, type Result } from '@/lib/result';
import { scoreObjective, type ScorableQuestion } from './objective';

/**
 * Saves the submission and the multiple-choice scores. This is one of the few places that reads `question_keys`
 * (the others are recruiter routes): answer keys never travel to a candidate route.
 * The unique constraint on submissions.invitation_id is the real guard against a second submission.
 */
export async function submitAssessment(inv: ResolvedInvitation, now: Date): Promise<Result<{ submittedAt: string; autoSubmitted: boolean; submissionId: string; objective: { total: number; max: number } }>> {
  const db = getDb();
  const autoSubmitted = Boolean(inv.deadline_at && now.getTime() > new Date(inv.deadline_at).getTime());
  const submittedAt = now.toISOString();

  const [qs, ans] = await Promise.all([
    db.from('questions').select('id, type, max_score').eq('assessment_id', inv.assessment_id).order('position'),
    db.from('answers').select('question_id, selected_option').eq('invitation_id', inv.id),
  ]);
  if (qs.error || ans.error) return err('db_error', "Couldn't read your answers.");
  const questions = qs.data as { id: string; type: 'mcq' | 'short'; max_score: number }[];
  const keys = await db.from('question_keys').select('question_id, correct_option').in('question_id', questions.map((q) => q.id));
  if (keys.error) return err('db_error', "Couldn't score the assessment.");
  const keyOf = new Map((keys.data as { question_id: string; correct_option: number | null }[]).map((k) => [k.question_id, k.correct_option]));

  const scorable: ScorableQuestion[] = questions.map((q) => ({ id: q.id, type: q.type, max_score: Number(q.max_score), correct_option: keyOf.get(q.id) ?? null }));
  const result = scoreObjective(scorable, ans.data as { question_id: string; selected_option: number | null }[]);
  const hasWritten = questions.some((q) => q.type === 'short');

  const sub = await db.from('submissions').insert({
    invitation_id: inv.id,
    submitted_at: submittedAt,
    auto_submitted: autoSubmitted,
    objective_score: result.total,
    objective_max: result.max,
    // With written answers, the final score waits for grading; otherwise it is the objective score.
    final_score: hasWritten ? null : result.total,
    final_max: hasWritten ? null : result.max,
    scoring_status: hasWritten ? 'pending' : 'scored',
    is_simulated: inv.simulated ?? false,
  }).select('id').single();
  if (sub.error) {
    if (sub.error.code === '23505') return err('already_submitted', 'This assessment was already submitted.');
    return err('db_error', "Couldn't save your submission.", sub.error.message);
  }
  const submissionId = sub.data.id as string;

  // The score rows and the invitation update do not depend on each other, so they go together.
  const [scoreInsert] = await Promise.all([
    result.scores.length > 0
      ? db.from('question_scores').insert(result.scores.map((s) => ({ submission_id: submissionId, method: 'auto' as const, ...s })))
      : Promise.resolve({ error: null }),
    db.from('invitations').update({ status: 'submitted', submitted_at: submittedAt, last_activity_at: submittedAt }).eq('id', inv.id),
  ]);
  if (scoreInsert.error) {
    console.error('question_scores insert failed:', scoreInsert.error.message);
    await db.from('submissions').update({ scoring_status: 'failed', scoring_error: "Couldn't save the question scores." }).eq('id', submissionId);
  }
  return ok({ submittedAt, autoSubmitted, submissionId, objective: { total: result.total, max: result.max } });
}

/**
 * Everything that does not need to block the candidate: moving the candidate to "Submitted", the receipts, and the
 * run's progress counter. Routes run this with `after()` so "Submitted" appears as soon as the answers are safe.
 */
export async function afterSubmit(inv: ResolvedInvitation, done: { autoSubmitted: boolean; objective: { total: number; max: number } }): Promise<void> {
  const db = getDb();
  const base = { runId: inv.assessment.run_id, jobId: inv.assessment.job_id, candidateId: inv.candidate_id, isSimulated: inv.simulated ?? false };
  // One round trip: the stage change (only from the stages that lead here, per lib/status.ts) and both receipts.
  await Promise.all([
    db.from('candidates').update({ stage: 'assessment_submitted' }).eq('id', inv.candidate_id).in('stage', ['assessment_in_progress', 'assessment_invited']),
    logEvent({ ...base, type: 'candidate.submitted', actor: 'candidate', level: 'success', message: `${inv.firstName} submitted${done.autoSubmitted ? ' (time ran out)' : ''}`, data: { autoSubmitted: done.autoSubmitted } }),
    logEvent({ ...base, type: 'score.objective_computed', actor: 'system', message: `Multiple-choice score for ${inv.firstName}: ${done.objective.total} of ${done.objective.max}`, data: done.objective }),
    updateTrackStep(inv.assessment_id, inv.assessment.run_id, inv.assessment.job_id),
  ]);
  await sendSubmissionEmail(inv, done.autoSubmitted);
}
