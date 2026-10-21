import 'server-only';
import { getDb } from '@/lib/db/server';
import { err, ok, type Result } from '@/lib/result';
import type { DeliveryStatus, InvitationStatus, RunStatus, StepStatus } from '@/lib/status';
import type { EventActor, EventLevel } from '@/lib/db/types';

export type LiveStep = { id: string; position: number; action: string; title: string; status: StepStatus; message: string | null; error: string | null; started_at: string | null; finished_at: string | null };
export type LiveInvitation = {
  id: string; candidate_id: string; name: string; has_email: boolean; status: InvitationStatus; delivery_status: DeliveryStatus;
  current_question: number | null; deadline_at: string | null; submitted_at: string | null; last_activity_at: string | null;
};
export type LiveEvent = { id: number; message: string; actor: EventActor; level: EventLevel; is_simulated: boolean; created_at: string };

export type RunLive = {
  serverNow: string;
  run: { id: string; status: RunStatus; error: string | null; summary: string; approved_at: string | null };
  steps: LiveStep[];
  assessment: { id: string; title: string; duration_minutes: number; status: string; question_count: number } | null;
  invitations: LiveInvitation[];
  events: LiveEvent[];
  tasks: { id: string; type: string; title: string; status: string }[];
};

/** One small, explicit-column read for the polling screens. No model calls. */
export async function getRunLive(runId: string): Promise<Result<RunLive | null>> {
  const db = getDb();
  const run = await db.from('workflow_runs').select('id, status, error, plan, approved_at').eq('id', runId).maybeSingle();
  if (run.error) return err('db_error', "Couldn't load the workflow.", run.error.message);
  if (!run.data) return ok(null);

  const [steps, assessment, events, tasks] = await Promise.all([
    db.from('workflow_steps').select('id, position, action, title, status, result, error, started_at, finished_at').eq('run_id', runId).order('position'),
    db.from('assessments').select('id, title, duration_minutes, status').eq('run_id', runId).maybeSingle(),
    db.from('workflow_events').select('id, message, actor, level, is_simulated, created_at').eq('run_id', runId).order('id', { ascending: false }).limit(30),
    db.from('tasks').select('id, type, title, status').eq('run_id', runId).eq('status', 'open'),
  ]);
  const failed = [steps, assessment, events, tasks].find((r) => r.error);
  if (failed?.error) return err('db_error', "Couldn't load the workflow.", failed.error.message);

  let invitations: LiveInvitation[] = [];
  let questionCount = 0;
  if (assessment.data) {
    const [inv, qc] = await Promise.all([
      db.from('invitations')
        .select('id, candidate_id, status, delivery_status, current_question, deadline_at, submitted_at, last_activity_at, candidates(full_name, email)')
        .eq('assessment_id', assessment.data.id).order('created_at').order('id'),
      db.from('questions').select('id', { count: 'exact', head: true }).eq('assessment_id', assessment.data.id),
    ]);
    if (inv.error) return err('db_error', "Couldn't load the candidate links.", inv.error.message);
    questionCount = qc.count ?? 0;
    type Row = Omit<LiveInvitation, 'name' | 'has_email'> & { candidates: { full_name: string; email: string | null } | null };
    // Same order as the candidate list (seeded IDs are sequential), not the random order of invitation IDs.
    invitations = (inv.data as unknown as Row[])
      .map(({ candidates, ...r }) => ({ ...r, name: candidates?.full_name ?? 'Candidate', has_email: Boolean(candidates?.email) }))
      .sort((a, b) => a.candidate_id.localeCompare(b.candidate_id));
  }

  const plan = run.data.plan as { summary?: string };
  return ok({
    serverNow: new Date().toISOString(),
    run: { id: run.data.id as string, status: run.data.status as RunStatus, error: (run.data.error as string | null) ?? null, summary: plan.summary ?? '', approved_at: (run.data.approved_at as string | null) ?? null },
    steps: (steps.data as unknown as (Omit<LiveStep, 'message'> & { result: { message?: string } | null })[]).map(({ result, ...s }) => ({ ...s, message: result?.message ?? null })),
    assessment: assessment.data ? { id: assessment.data.id as string, title: assessment.data.title as string, duration_minutes: assessment.data.duration_minutes as number, status: assessment.data.status as string, question_count: questionCount } : null,
    invitations,
    events: events.data as unknown as LiveEvent[],
    tasks: tasks.data as unknown as RunLive['tasks'],
  });
}
