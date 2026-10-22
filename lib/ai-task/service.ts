import 'server-only';
import { assistantReply, fallbackAssistantReply, planTask, reviewTask } from '@/lib/ai/task';
import { getDb } from '@/lib/db/server';
import { logEvent } from '@/lib/events';
import type { ResolvedInvitation } from '@/lib/portal/service';
import { err, ok, type Result } from '@/lib/result';
import { flawOutcome, MAX_DELIVERABLE_CHARS, MAX_MESSAGE_CHARS, MAX_MESSAGES, mentionsAny, OUTCOME_LABEL, taskMetrics, TASK_MINUTES, timeIsUp, type ChatMsg, type FlawOutcome, type TaskDef, type TaskMetrics, type TaskReview } from './rules';

type Row = { id: string; status: 'in_progress' | 'completed'; task: TaskDef; chat: ChatMsg[]; deliverable: string; metrics: (TaskMetrics & { outcome: FlawOutcome }) | null; started_at: string };

/** What the candidate's page may see. The planted mistake stays hidden until they have submitted. */
export type CandidateTaskState = {
  status: 'none' | 'in_progress' | 'completed';
  task: { title: string; brief: string; deliverable: string } | null;
  chat: ChatMsg[];
  draft: string;
  secondsLeft: number | null;
  messagesLeft: number;
  /** The expected length of the chat, sent back with each message so a repeated request cannot add the same message twice. */
  chatLength: number;
  debrief: { wrongStatement: string; why: string; outcome: string } | null;
};

const COLS = 'id, status, task, chat, deliverable, metrics, started_at';

function toState(row: Row | null, now: Date): CandidateTaskState {
  if (!row) return { status: 'none', task: null, chat: [], draft: '', secondsLeft: null, messagesLeft: MAX_MESSAGES, chatLength: 0, debrief: null };
  const used = row.chat.filter((m) => m.role === 'candidate').length;
  const done = row.status === 'completed';
  return {
    status: row.status,
    task: { title: row.task.title, brief: row.task.brief, deliverable: row.task.deliverable },
    chat: row.chat, draft: row.deliverable,
    secondsLeft: done ? null : Math.max(0, Math.round((new Date(row.started_at).getTime() + TASK_MINUTES * 60_000 - now.getTime()) / 1000)),
    messagesLeft: Math.max(0, MAX_MESSAGES - used), chatLength: row.chat.length,
    debrief: done ? { wrongStatement: row.task.flaw.wrongStatement, why: row.task.flaw.why, outcome: OUTCOME_LABEL[row.metrics?.outcome ?? 'not_shown'] } : null,
  };
}

async function load(invitationId: string): Promise<Row | null> {
  const { data } = await getDb().from('ai_tasks').select(COLS).eq('invitation_id', invitationId).maybeSingle();
  return (data as Row | null) ?? null;
}

export async function getState(inv: ResolvedInvitation, now = new Date()): Promise<CandidateTaskState> {
  return toState(await load(inv.id), now);
}

export async function start(inv: ResolvedInvitation, now: Date): Promise<Result<CandidateTaskState>> {
  if (!inv.assessment.ai_task) return err('not_enabled', 'This assessment has no AI task.');
  const existing = await load(inv.id);
  if (existing) return ok(toState(existing, now));
  const job = await getDb().from('jobs').select('title, description, skills').eq('id', inv.assessment.job_id).maybeSingle();
  const planned = await planTask({ jobTitle: (job.data?.title as string | undefined) ?? inv.jobTitle, description: (job.data?.description as string | undefined) ?? '', skills: (job.data?.skills as string[] | undefined) ?? [] });
  const ins = await getDb().from('ai_tasks').insert({ invitation_id: inv.id, task: planned.task, started_at: now.toISOString() }).select(COLS).single();
  if (ins.error) {
    const again = await load(inv.id);
    return again ? ok(toState(again, now)) : err('db_error', "Couldn't start the task.", ins.error.message);
  }
  await logEvent({ runId: inv.assessment.run_id, jobId: inv.assessment.job_id, candidateId: inv.candidate_id, actor: 'candidate', type: 'ai_task.started', message: `${inv.firstName} started the AI-collaboration task${planned.meta ? '' : ' (standard task)'}` });
  return ok(toState(ins.data as Row, now));
}

/** One message to the assistant. `expected` is the chat length the page last saw; a repeat of an old request changes nothing. */
export async function chat(inv: ResolvedInvitation, text: string, expected: number | undefined, now: Date): Promise<Result<CandidateTaskState>> {
  const row = await load(inv.id);
  if (!row) return err('not_started', 'The task has not started.');
  if (row.status === 'completed') return ok(toState(row, now));
  if (expected !== undefined && expected !== row.chat.length) return ok(toState(row, now));
  if (timeIsUp(row.started_at, now)) return err('time_up', 'Time is up. Submit your answer.');
  const clean = text.trim().slice(0, MAX_MESSAGE_CHARS);
  if (clean.length < 2) return err('invalid_input', 'Write a message first.');
  if (row.chat.filter((m) => m.role === 'candidate').length >= MAX_MESSAGES) return err('limit', 'You have used all your messages. Finish your answer and submit it.');

  const withMine: ChatMsg[] = [...row.chat, { role: 'candidate', text: clean, at: now.toISOString() }];
  const shown = withMine.some((m) => m.role === 'assistant' && mentionsAny(m.text, row.task.flaw.wrongMarkers));
  const reply = await assistantReply(row.task, withMine, shown);
  const text2 = reply.ok ? reply.data.reply : fallbackAssistantReply(row.task, shown);
  const next: ChatMsg[] = [...withMine, { role: 'assistant', text: text2, at: new Date().toISOString() }];
  const upd = await getDb().from('ai_tasks').update({ chat: next }).eq('id', row.id).eq('status', 'in_progress').select(COLS);
  if (upd.error) return err('db_error', "Couldn't send that.", upd.error.message);
  return ok(toState((upd.data?.[0] as Row | undefined) ?? { ...row, chat: next }, now));
}

export async function saveDraft(inv: ResolvedInvitation, deliverable: string): Promise<void> {
  await getDb().from('ai_tasks').update({ deliverable: deliverable.slice(0, MAX_DELIVERABLE_CHARS) }).eq('invitation_id', inv.id).eq('status', 'in_progress');
}

/** Finishes the task: counts what happened by code and saves it. The evidence notes are written after the response. */
export async function submit(inv: ResolvedInvitation, deliverable: string, now: Date): Promise<Result<{ state: CandidateTaskState; taskId: string }>> {
  const row = await load(inv.id);
  if (!row) return err('not_started', 'The task has not started.');
  if (row.status === 'completed') return ok({ state: toState(row, now), taskId: row.id });
  const final = deliverable.trim().slice(0, MAX_DELIVERABLE_CHARS);
  if (final.length < 20) return err('invalid_input', 'Write your answer first.');
  const outcome = flawOutcome(row.task, row.chat, final).outcome;
  const metrics = { ...taskMetrics(row.chat, final), outcome };
  const upd = await getDb().from('ai_tasks').update({ status: 'completed', deliverable: final, metrics, completed_at: now.toISOString() }).eq('id', row.id).eq('status', 'in_progress').select(COLS);
  if (upd.error) return err('db_error', "Couldn't save your answer.", upd.error.message);
  await logEvent({ runId: inv.assessment.run_id, jobId: inv.assessment.job_id, candidateId: inv.candidate_id, actor: 'candidate', type: 'ai_task.completed', level: 'success', message: `${inv.firstName} finished the AI-collaboration task` });
  return ok({ state: toState((upd.data?.[0] as Row | undefined) ?? { ...row, status: 'completed', deliverable: final, metrics }, now), taskId: row.id });
}

/** Writes the evidence notes. Never throws; if the AI is unavailable, a plain note is written from the counted facts. */
export async function writeReview(taskId: string): Promise<Result<TaskReview>> {
  const db = getDb();
  const q = await db.from('ai_tasks').select('id, task, chat, deliverable, metrics, invitations(assessments(jobs(title)))').eq('id', taskId).maybeSingle();
  if (q.error || !q.data) return err('not_found', 'Task not found.');
  const r = q.data as unknown as { task: TaskDef; chat: ChatMsg[]; deliverable: string; metrics: (TaskMetrics & { outcome: FlawOutcome }) | null; invitations: { assessments: { jobs: { title: string } | null } | null } | null };
  const outcome = r.metrics?.outcome ?? flawOutcome(r.task, r.chat, r.deliverable).outcome;
  const metrics = r.metrics ?? { ...taskMetrics(r.chat, r.deliverable), outcome };
  const candidateText = r.chat.filter((m) => m.role === 'candidate').map((m) => m.text).join('\n');
  const res = await reviewTask({ jobTitle: r.invitations?.assessments?.jobs?.title ?? 'the role', task: r.task, outcome, metrics, candidateText, deliverable: r.deliverable });
  const review: TaskReview = res.ok ? res.data.review : {
    outcome, label: OUTCOME_LABEL[outcome], aiModel: null, observations: [],
    summary: `${metrics.prompts} ${metrics.prompts === 1 ? 'message' : 'messages'} to the assistant, ${metrics.verifyAsks} asking it to check something. About ${Math.round(metrics.copyShare * 100)} percent of the final answer was copied from the assistant. The AI notes were not available; read the transcript.`,
  };
  const up = await db.from('ai_tasks').update({ review }).eq('id', taskId);
  return up.error ? err('db_error', "Couldn't save the notes.", up.error.message) : ok(review);
}
