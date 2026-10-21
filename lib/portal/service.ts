import 'server-only';
import { getDb } from '@/lib/db/server';
import { logEvent } from '@/lib/events';
import { err, ok, type Result } from '@/lib/result';
import { hashToken } from '@/lib/security/tokens';
import { assertTransition, type Stage } from '@/lib/status';
import { firstNameOf } from '@/lib/invitations/template';

export type ResolvedInvitation = {
  id: string;
  assessment_id: string;
  candidate_id: string;
  status: string;
  expires_at: string;
  consent_at: string | null;
  opened_at: string | null;
  started_at: string | null;
  deadline_at: string | null;
  submitted_at: string | null;
  current_question: number | null;
  assessment: { id: string; title: string; instructions: string; duration_minutes: number; status: string; job_id: string; run_id: string | null };
  jobTitle: string;
  firstName: string;
};

// 43 base64url characters: 32 random bytes. Anything else cannot be a real link, so skip the database.
const TOKEN_SHAPE = /^[A-Za-z0-9_-]{43}$/;

const COLUMNS =
  'id, assessment_id, candidate_id, status, expires_at, consent_at, opened_at, started_at, deadline_at, submitted_at, current_question, ' +
  'assessments(id, title, instructions, duration_minutes, status, job_id, run_id, jobs(title)), candidates(full_name)';

type Row = Omit<ResolvedInvitation, 'assessment' | 'jobTitle' | 'firstName'> & {
  assessments: (ResolvedInvitation['assessment'] & { jobs: { title: string } | null }) | null;
  candidates: { full_name: string } | null;
};

/** Looks the invitation up by the hash of the token. Unknown or malformed tokens are `null`, never an error that hints at why. */
export async function resolveInvitation(token: string): Promise<Result<ResolvedInvitation | null>> {
  if (!TOKEN_SHAPE.test(token)) return ok(null);
  const { data, error } = await getDb().from('invitations').select(COLUMNS).eq('token_hash', hashToken(token)).maybeSingle();
  if (error) return err('db_error', "Couldn't load the assessment.", error.message);
  if (!data) return ok(null);
  const row = data as unknown as Row;
  if (!row.assessments) return ok(null);
  const { assessments, candidates, ...inv } = row;
  const { jobs, ...assessment } = assessments;
  return ok({ ...inv, assessment, jobTitle: jobs?.title ?? 'this role', firstName: firstNameOf(candidates?.full_name ?? 'there') });
}

const eventBase = (inv: ResolvedInvitation) => ({
  runId: inv.assessment.run_id, jobId: inv.assessment.job_id, candidateId: inv.candidate_id, actor: 'candidate' as const,
});

/** First open: records it once. Nothing changes once the candidate has started. */
export async function markOpened(inv: ResolvedInvitation): Promise<void> {
  if (inv.opened_at || inv.started_at) return;
  const upd = await getDb().from('invitations')
    .update({ opened_at: new Date().toISOString(), ...(['created', 'sent'].includes(inv.status) ? { status: 'opened' } : {}) })
    .eq('id', inv.id).is('opened_at', null).select('id');
  if (upd.data && upd.data.length > 0) {
    await logEvent({ ...eventBase(inv), type: 'candidate.opened', message: `${inv.firstName} opened their link` });
  }
}

export async function questionCount(assessmentId: string): Promise<number> {
  const { count } = await getDb().from('questions').select('id', { count: 'exact', head: true }).eq('assessment_id', assessmentId);
  return count ?? 0;
}

/**
 * Starts the timer on the server. Idempotent: if the test was already started, the existing deadline is returned
 * and nothing is reset, so refreshing the page can never give a candidate more time.
 */
export async function startAssessment(inv: ResolvedInvitation, now: Date): Promise<Result<{ deadlineAt: string; startedAt: string }>> {
  if (inv.started_at && inv.deadline_at) return ok({ deadlineAt: inv.deadline_at, startedAt: inv.started_at });
  const db = getDb();
  const startedAt = now.toISOString();
  const deadlineAt = new Date(now.getTime() + inv.assessment.duration_minutes * 60_000).toISOString();
  const upd = await db.from('invitations')
    .update({ consent_at: startedAt, started_at: startedAt, deadline_at: deadlineAt, status: 'started', last_activity_at: startedAt })
    .eq('id', inv.id).is('started_at', null).select('id');
  if (upd.error) return err('db_error', "Couldn't start the assessment.", upd.error.message);
  if (!upd.data || upd.data.length === 0) {
    // Someone else started it a moment ago: return what they set.
    const again = await db.from('invitations').select('started_at, deadline_at').eq('id', inv.id).single();
    return ok({ startedAt: again.data?.started_at as string, deadlineAt: again.data?.deadline_at as string });
  }
  return ok({ startedAt, deadlineAt });
}

/** The parts of starting that need not block the candidate: the stage change and the receipt. Run with `after()`. */
export async function afterStart(inv: ResolvedInvitation): Promise<void> {
  const db = getDb();
  const cand = await db.from('candidates').select('stage').eq('id', inv.candidate_id).maybeSingle();
  const stage = cand.data?.stage as Stage | undefined;
  if (stage && assertTransition('candidate', stage, 'assessment_in_progress').ok) {
    await db.from('candidates').update({ stage: 'assessment_in_progress' }).eq('id', inv.candidate_id).eq('stage', stage);
  }
  await logEvent({ ...eventBase(inv), type: 'candidate.started', level: 'info', message: `${inv.firstName} started the assessment` });
}

export type SavedAnswer = { question_id: string; selected_option: number | null; text_answer: string | null };

export async function listSavedAnswers(invitationId: string): Promise<Result<SavedAnswer[]>> {
  const { data, error } = await getDb().from('answers').select('question_id, selected_option, text_answer').eq('invitation_id', invitationId);
  if (error) return err('db_error', "Couldn't load your saved answers.", error.message);
  return ok(data as SavedAnswer[]);
}

/** The question must belong to this invitation's assessment. Returns only what validation needs, never a key. */
export async function getQuestionForAnswer(assessmentId: string, questionId: string): Promise<Result<{ id: string; type: 'mcq' | 'short'; options: string[] | null } | null>> {
  const { data, error } = await getDb().from('questions').select('id, type, options').eq('id', questionId).eq('assessment_id', assessmentId).maybeSingle();
  if (error) return err('db_error', "Couldn't check the question.", error.message);
  return ok((data as { id: string; type: 'mcq' | 'short'; options: string[] | null } | null) ?? null);
}

export async function saveAnswer(inv: ResolvedInvitation, questionId: string, answer: { selected_option: number | null; text_answer: string | null }, currentQuestion: number): Promise<Result<{ savedAt: string }>> {
  const db = getDb();
  const savedAt = new Date().toISOString();
  // Independent writes, so they share one round trip.
  const [up] = await Promise.all([
    db.from('answers').upsert(
      { invitation_id: inv.id, question_id: questionId, selected_option: answer.selected_option, text_answer: answer.text_answer, saved_at: savedAt },
      { onConflict: 'invitation_id,question_id' },
    ),
    db.from('invitations').update({ current_question: currentQuestion, last_activity_at: savedAt }).eq('id', inv.id),
  ]);
  if (up.error) return err('db_error', "Couldn't save your answer.", up.error.message);
  return ok({ savedAt });
}

const SIGNAL_TYPES = new Set(['tab_hidden', 'paste', 'window_blur']);

/** Signals are recorded as hints for the recruiter, never as proof, and never block the candidate. */
export async function recordSignals(inv: ResolvedInvitation, events: { type: string; at?: string }[], now: Date): Promise<void> {
  const started = inv.started_at ? new Date(inv.started_at).getTime() : now.getTime();
  const rows = events.filter((e) => SIGNAL_TYPES.has(e.type)).map((e) => {
    const t = e.at ? new Date(e.at).getTime() : NaN;
    const occurred = Number.isFinite(t) && t >= started && t <= now.getTime() ? new Date(t) : now;
    return { invitation_id: inv.id, type: e.type, occurred_at: occurred.toISOString() };
  });
  if (rows.length > 0) {
    const { error } = await getDb().from('integrity_signals').insert(rows);
    if (error) console.error('signals insert failed:', error.message);
  }
}
