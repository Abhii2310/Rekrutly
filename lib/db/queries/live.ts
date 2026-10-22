import 'server-only';
import { getDb } from '@/lib/db/server';
import { err, ok, type Result } from '@/lib/result';
import type { DeliveryStatus, InvitationStatus, RunStatus, StepStatus } from '@/lib/status';
import type { EventActor, EventLevel, TaskDraft } from '@/lib/db/types';
import { computeNextActions } from '@/lib/tasks/next-actions';
import { ALERT_SIGNALS, CAMERA_SIGNALS } from '@/lib/proctor/signals';
import { INVITATION_SELECT, toPipelineInvitation } from '@/lib/tasks/pipeline';

export type LiveStep = { id: string; position: number; action: string; title: string; status: StepStatus; message: string | null; error: string | null; started_at: string | null; finished_at: string | null };
export type LiveInvitation = {
  id: string; candidate_id: string; name: string; has_email: boolean; status: InvitationStatus; delivery_status: DeliveryStatus;
  current_question: number | null; deadline_at: string | null; submitted_at: string | null; last_activity_at: string | null;
  /** Counted on the server from the deadline, so a wrong clock in the browser cannot change it. Null when not in progress. */
  seconds_left: number | null;
  /** Integrity hints, counted from recorded signals. Hints for a person, never proof. */
  signals: { tab_hidden: number; paste: number };
  /** Proctored tests only: when the latest camera picture arrived, and how many camera alerts there have been. */
  proctored: boolean; snapshot_at: string | null; alerts: number;
  /** Set when the invitation email bounced or could not be sent, with the address it went to so it can be fixed. */
  email: string | null; delivery_error: string | null; phone: string | null;
};
export type LiveAlert = { id: string; invitation_id: string; name: string; type: string; occurred_at: string; video_ms: number | null };
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
  assessment: { id: string; title: string; duration_minutes: number; status: string; question_count: number; proctored: boolean } | null;
  invitations: LiveInvitation[];
  /** Newest first. Only on proctored tests. Moments for a person to review, never proof. */
  alerts: LiveAlert[];
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

/**
 * One round trip to the database, not three: the run, steps, events and tasks are read together, and the assessment comes
 * with its candidates, submissions, integrity signals and question count embedded. No model calls.
 */
export async function getRunLive(runId: string): Promise<Result<RunLive | null>> {
  const db = getDb();
  const [run, steps, assessment, events, taskRows] = await Promise.all([
    db.from('workflow_runs').select('id, status, error, plan, approved_at').eq('id', runId).maybeSingle(),
    db.from('workflow_steps').select('id, position, action, title, status, result, error, started_at, finished_at').eq('run_id', runId).order('position'),
    db.from('assessments')
      .select(`id, title, duration_minutes, status, proctored, questions(count), invitations(${INVITATION_SELECT}, proctor_consent_at, last_snapshot_at, delivery_error, integrity_signals(id, type, occurred_at, video_ms))`)
      .eq('run_id', runId).maybeSingle(),
    db.from('workflow_events').select('id, message, actor, level, is_simulated, created_at').eq('run_id', runId).order('id', { ascending: false }).limit(30),
    db.from('tasks').select('id, type, title, detail, status, candidate_id, dedupe_key, draft, created_at, candidates(full_name, email, phone)').eq('run_id', runId).eq('status', 'open').order('created_at').order('id'),
  ]);
  const failed = [run, steps, assessment, events, taskRows].find((r) => r.error);
  if (failed?.error) return err('db_error', "Couldn't load the workflow.", failed.error.message);
  if (!run.data) return ok(null);

  let invitations: LiveInvitation[] = [];
  let pipeline: ReturnType<typeof toPipelineInvitation>[] = [];
  let questionCount = 0;
  const alertList: Omit<LiveAlert, 'name'>[] = [];
  if (assessment.data) {
    type Sig = { id: string; type: string; occurred_at: string; video_ms: number | null };
    type Embedded = { proctored: boolean; questions: { count: number }[]; invitations: (Record<string, unknown> & { integrity_signals: Sig[] })[] };
    const emb = assessment.data as unknown as Embedded;
    questionCount = emb.questions?.[0]?.count ?? 0;
    const now = Date.now();
    const signalsOf = new Map<string, { tab_hidden: number; paste: number }>();
    const camera = new Map<string, number>();
    const snapshotOf = new Map<string, string | null>();
    const errorOf = new Map<string, string | null>();
    const sigs: { sig: Sig; invitation: string }[] = [];
    for (const i of emb.invitations ?? []) {
      const cur = { tab_hidden: 0, paste: 0 };
      for (const sg of i.integrity_signals ?? []) {
        if (sg.type === 'tab_hidden') cur.tab_hidden++;
        else if (sg.type === 'paste') cur.paste++;
        if (ALERT_SIGNALS.has(sg.type)) sigs.push({ sig: sg, invitation: i.id as string });
        if ((CAMERA_SIGNALS as readonly string[]).includes(sg.type)) camera.set(i.id as string, (camera.get(i.id as string) ?? 0) + 1);
      }
      snapshotOf.set(i.id as string, (i.last_snapshot_at as string | null) ?? null);
      errorOf.set(i.id as string, (i.delivery_error as string | null) ?? null);
      signalsOf.set(i.id as string, cur);
    }
    for (const x of sigs) alertList.push({ id: x.sig.id, invitation_id: x.invitation, type: x.sig.type, occurred_at: x.sig.occurred_at, video_ms: x.sig.video_ms });
    // Same order as the candidate list (seeded IDs are sequential), not the random order of invitation IDs.
    pipeline = (emb.invitations ?? []).map(toPipelineInvitation).sort((x, y) => x.candidateId.localeCompare(y.candidateId));
    invitations = pipeline.map((i) => ({
      id: i.id, candidate_id: i.candidateId, name: i.name, has_email: Boolean(i.email), status: i.status, delivery_status: i.deliveryStatus,
      current_question: i.currentQuestion, deadline_at: i.deadlineAt, submitted_at: i.submittedAt, last_activity_at: i.lastActivityAt,
      signals: signalsOf.get(i.id) ?? { tab_hidden: 0, paste: 0 },
      email: i.email ?? null, phone: i.phone ?? null, delivery_error: errorOf.get(i.id) ?? null,
      proctored: emb.proctored, snapshot_at: snapshotOf.get(i.id) ?? null, alerts: camera.get(i.id) ?? 0,
      seconds_left: i.status === 'started' && i.deadlineAt ? Math.max(0, Math.round((new Date(i.deadlineAt).getTime() - now) / 1000)) : null,
    }));
  }

  type TaskRaw = { id: string; type: string; title: string; detail: string | null; status: string; candidate_id: string | null; dedupe_key: string | null; draft: TaskDraft | null; candidates: { full_name: string; email: string | null; phone: string | null } | null };
  const tasks = (taskRows.data as unknown as TaskRaw[]).map(({ dedupe_key, candidates, ...t }) => ({
    ...t, candidate: candidates ? { name: candidates.full_name, email: candidates.email, phone: candidates.phone } : null, href: taskHref(t.type, dedupe_key, t.candidate_id),
  }));
  const overdue = tasks.filter((t) => t.type === 'follow_up').length;

  const names = new Map(invitations.map((i) => [i.id, i.name]));
  const alerts: LiveAlert[] = alertList.sort((a, b) => b.occurred_at.localeCompare(a.occurred_at)).slice(0, 30).map((a) => ({ ...a, name: names.get(a.invitation_id) ?? 'Candidate' }));

  const plan = run.data.plan as { summary?: string };
  return ok({
    serverNow: new Date().toISOString(),
    run: { id: run.data.id as string, status: run.data.status as RunStatus, error: (run.data.error as string | null) ?? null, summary: plan.summary ?? '', approved_at: (run.data.approved_at as string | null) ?? null },
    steps: (steps.data as unknown as (Omit<LiveStep, 'message'> & { result: { message?: string } | null })[]).map(({ result, ...s }) => ({ ...s, message: result?.message ?? null })),
    assessment: assessment.data ? { id: assessment.data.id as string, title: assessment.data.title as string, duration_minutes: assessment.data.duration_minutes as number, status: assessment.data.status as string, question_count: questionCount, proctored: Boolean(assessment.data.proctored) } : null,
    invitations,
    events: events.data as unknown as LiveEvent[],
    tasks,
    alerts,
    nextActions: computeNextActions(pipeline, overdue),
  });
}
