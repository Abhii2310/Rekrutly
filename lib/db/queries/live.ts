import 'server-only';
import { getDb } from '@/lib/db/server';
import { err, ok, type Result } from '@/lib/result';
import type { DeliveryStatus, InvitationStatus, RunStatus, StepStatus } from '@/lib/status';
import type { EventActor, EventLevel, TaskDraft } from '@/lib/db/types';
import { computeNextActions } from '@/lib/tasks/next-actions';
import { INVITATION_SELECT, toPipelineInvitation } from '@/lib/tasks/pipeline';

export type LiveStep = { id: string; position: number; action: string; title: string; status: StepStatus; message: string | null; error: string | null; started_at: string | null; finished_at: string | null };
export type LiveInvitation = {
  id: string; candidate_id: string; name: string; has_email: boolean; status: InvitationStatus; delivery_status: DeliveryStatus;
  current_question: number | null; deadline_at: string | null; submitted_at: string | null; last_activity_at: string | null;
  /** Counted on the server from the deadline, so a wrong clock in the browser cannot change it. Null when not in progress. */
  seconds_left: number | null;
};
export type LiveTask = {
  id: string; type: string; title: string; detail: string | null; status: string; candidate_id: string | null;
  candidate: { name: string; email: string | null; phone: string | null } | null;
  draft: TaskDraft | null;
  /** Where "Open" goes for tasks that are about a page, such as a submission. */
  href: string | null;
};
export type LiveEvent = { id: number; message: string; actor: EventActor; level: EventLevel; is_simulated: boolean; created_at: string };

export type RunLive = {
  serverNow: string;
  run: { id: string; status: RunStatus; error: string | null; summary: string; approved_at: string | null };
  steps: LiveStep[];
  assessment: { id: string; title: string; duration_minutes: number; status: string; question_count: number } | null;
  invitations: LiveInvitation[];
  events: LiveEvent[];
  tasks: LiveTask[];
  /** Up to four plain sentences from rules, no model. */
  nextActions: string[];
};

function taskHref(type: string, key: string | null, candidateId: string | null): string | null {
  if (type === 'review_submission' && key?.startsWith('review_submission:')) return `/submissions/${key.slice('review_submission:'.length)}`;
  if (candidateId && (type === 'missing_email' || type === 'schedule_interview')) return `/candidates?c=${candidateId}`;
  return null;
}

/** One small, explicit-column read for the polling screens. No model calls. */
export async function getRunLive(runId: string): Promise<Result<RunLive | null>> {
  const db = getDb();
  const run = await db.from('workflow_runs').select('id, status, error, plan, approved_at').eq('id', runId).maybeSingle();
  if (run.error) return err('db_error', "Couldn't load the workflow.", run.error.message);
  if (!run.data) return ok(null);

  const [steps, assessment, events, taskRows] = await Promise.all([
    db.from('workflow_steps').select('id, position, action, title, status, result, error, started_at, finished_at').eq('run_id', runId).order('position'),
    db.from('assessments').select('id, title, duration_minutes, status').eq('run_id', runId).maybeSingle(),
    db.from('workflow_events').select('id, message, actor, level, is_simulated, created_at').eq('run_id', runId).order('id', { ascending: false }).limit(30),
    db.from('tasks').select('id, type, title, detail, status, candidate_id, dedupe_key, draft, created_at, candidates(full_name, email, phone)').eq('run_id', runId).eq('status', 'open').order('created_at').order('id'),
  ]);
  const failed = [steps, assessment, events, taskRows].find((r) => r.error);
  if (failed?.error) return err('db_error', "Couldn't load the workflow.", failed.error.message);

  let invitations: LiveInvitation[] = [];
  let pipeline: ReturnType<typeof toPipelineInvitation>[] = [];
  let questionCount = 0;
  if (assessment.data) {
    const [inv, qc] = await Promise.all([
      db.from('invitations').select(INVITATION_SELECT).eq('assessment_id', assessment.data.id).order('created_at').order('id'),
      db.from('questions').select('id', { count: 'exact', head: true }).eq('assessment_id', assessment.data.id),
    ]);
    if (inv.error) return err('db_error', "Couldn't load the candidate links.", inv.error.message);
    questionCount = qc.count ?? 0;
    const now = Date.now();
    // Same order as the candidate list (seeded IDs are sequential), not the random order of invitation IDs.
    pipeline = (inv.data as unknown[]).map(toPipelineInvitation).sort((x, y) => x.candidateId.localeCompare(y.candidateId));
    invitations = pipeline.map((i) => ({
      id: i.id, candidate_id: i.candidateId, name: i.name, has_email: Boolean(i.email), status: i.status, delivery_status: i.deliveryStatus,
      current_question: i.currentQuestion, deadline_at: i.deadlineAt, submitted_at: i.submittedAt, last_activity_at: i.lastActivityAt,
      seconds_left: i.status === 'started' && i.deadlineAt ? Math.max(0, Math.round((new Date(i.deadlineAt).getTime() - now) / 1000)) : null,
    }));
  }

  type TaskRaw = { id: string; type: string; title: string; detail: string | null; status: string; candidate_id: string | null; dedupe_key: string | null; draft: TaskDraft | null; candidates: { full_name: string; email: string | null; phone: string | null } | null };
  const tasks = (taskRows.data as unknown as TaskRaw[]).map(({ dedupe_key, candidates, ...t }) => ({
    ...t, candidate: candidates ? { name: candidates.full_name, email: candidates.email, phone: candidates.phone } : null, href: taskHref(t.type, dedupe_key, t.candidate_id),
  }));
  const overdue = tasks.filter((t) => t.type === 'follow_up').length;

  const plan = run.data.plan as { summary?: string };
  return ok({
    serverNow: new Date().toISOString(),
    run: { id: run.data.id as string, status: run.data.status as RunStatus, error: (run.data.error as string | null) ?? null, summary: plan.summary ?? '', approved_at: (run.data.approved_at as string | null) ?? null },
    steps: (steps.data as unknown as (Omit<LiveStep, 'message'> & { result: { message?: string } | null })[]).map(({ result, ...s }) => ({ ...s, message: result?.message ?? null })),
    assessment: assessment.data ? { id: assessment.data.id as string, title: assessment.data.title as string, duration_minutes: assessment.data.duration_minutes as number, status: assessment.data.status as string, question_count: questionCount } : null,
    invitations,
    events: events.data as unknown as LiveEvent[],
    tasks,
    nextActions: computeNextActions(pipeline, overdue),
  });
}
