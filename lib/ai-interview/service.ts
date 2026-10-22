import 'server-only';
import { followUp, planInterview } from '@/lib/ai/interview';
import { summarizeInterview } from '@/lib/ai/interview';
import { redactResume } from '@/lib/ats/rules';
import { getDb } from '@/lib/db/server';
import { logEvent } from '@/lib/events';
import type { ResolvedInvitation } from '@/lib/portal/service';
import { err, ok, type Result } from '@/lib/result';
import { applyAnswer, candidateText, currentPrompt, fallbackPlan, firstTurn, isVague, timeIsUp, type InterviewSummary, type PlanQuestion, type Turn } from './rules';

type Row = { id: string; status: 'in_progress' | 'completed'; plan: PlanQuestion[]; turns: Turn[]; started_at: string };

/** What the candidate's page needs: where they are in the conversation. Never the reasons behind a question. */
export type CandidateState = { status: 'none' | 'in_progress' | 'completed'; total: number; index: number; prompt: { text: string; kind: 'question' | 'followup' } | null };

function toState(row: Row | null): CandidateState {
  if (!row) return { status: 'none', total: 0, index: 0, prompt: null };
  const p = currentPrompt(row.turns);
  return { status: row.status, total: row.plan.length, index: p ? p.qi + 1 : row.plan.length, prompt: row.status === 'in_progress' && p && p.kind !== 'answer' ? { text: p.text, kind: p.kind } : null };
}

async function load(invitationId: string): Promise<Row | null> {
  const { data } = await getDb().from('ai_interviews').select('id, status, plan, turns, started_at').eq('invitation_id', invitationId).maybeSingle();
  return (data as Row | null) ?? null;
}

export async function getState(inv: ResolvedInvitation): Promise<CandidateState> {
  return toState(await load(inv.id));
}

/** Everything the interview is built from, gathered without anything personal beyond the resume text (contact details removed). */
async function gather(inv: ResolvedInvitation) {
  const db = getDb();
  const [cand, job, sub] = await Promise.all([
    db.from('candidates').select('resume_text').eq('id', inv.candidate_id).maybeSingle(),
    db.from('jobs').select('title, description, skills').eq('id', inv.assessment.job_id).maybeSingle(),
    db.from('submissions').select('skill_breakdown').eq('invitation_id', inv.id).maybeSingle(),
  ]);
  const resume = (cand.data?.resume_text as string | null | undefined)?.trim() || null;
  const breakdown = ((sub.data?.skill_breakdown as { skill: string; percent: number; max: number }[] | null) ?? []).filter((s) => s.max > 0);
  const weak = [...breakdown].sort((a, b) => a.percent - b.percent).slice(0, 2).map((s) => s.skill);
  return {
    jobTitle: (job.data?.title as string | undefined) ?? inv.jobTitle,
    jobDescription: (job.data?.description as string | undefined) ?? '',
    skills: ((job.data?.skills as string[] | undefined) ?? []),
    weakSkills: weak,
    resume: resume ? redactResume(resume) : null,
    assessmentLines: breakdown.map((s) => `${s.skill}: ${s.percent}% of the points`),
  };
}

export async function start(inv: ResolvedInvitation, now: Date): Promise<Result<CandidateState>> {
  if (!inv.assessment.ai_interview) return err('not_enabled', 'This assessment has no AI interview.');
  const existing = await load(inv.id);
  if (existing) return ok(toState(existing));

  const g = await gather(inv);
  const planned = await planInterview(g);
  const plan = planned.ok ? planned.data.plan : fallbackPlan({ jobTitle: g.jobTitle, skills: g.skills, weakSkills: g.weakSkills, hasResume: Boolean(g.resume) });
  const first = firstTurn(plan, now.toISOString());
  if (!first) return err('no_questions', "Couldn't prepare the questions.");
  const ins = await getDb().from('ai_interviews').insert({ invitation_id: inv.id, plan, turns: [first], started_at: now.toISOString() }).select('id, status, plan, turns, started_at').single();
  if (ins.error) {
    // Two tabs started it at once: use the one that won.
    const again = await load(inv.id);
    return again ? ok(toState(again)) : err('db_error', "Couldn't start the interview.", ins.error.message);
  }
  await logEvent({ runId: inv.assessment.run_id, jobId: inv.assessment.job_id, candidateId: inv.candidate_id, actor: 'candidate', type: 'ai_interview.started', message: `${inv.firstName} started the AI interview${planned.ok ? '' : ' (standard questions)'}` });
  return ok(toState(ins.data as Row));
}

/** Saves the answer and returns what the AI says next. Returns `done` when the conversation is over. */
export async function answer(inv: ResolvedInvitation, text: string, skipped: boolean, now: Date): Promise<Result<{ state: CandidateState; done: boolean }>> {
  const row = await load(inv.id);
  if (!row) return err('not_started', 'The interview has not started.');
  if (row.status === 'completed') return ok({ state: toState(row), done: true });
  const prompt = currentPrompt(row.turns);
  if (!prompt) return ok({ state: toState(row), done: false });

  const over = timeIsUp(row.started_at, now);
  let follow: string | null = null;
  if (!over && prompt.kind === 'question' && !skipped && !isVague(text)) follow = await followUp(prompt.text, text);
  const step = over ? { turns: [...row.turns, { role: 'candidate' as const, kind: 'answer' as const, qi: prompt.qi, text: skipped ? '' : text.trim(), at: now.toISOString(), ...(skipped ? { skipped: true } : {}) }], next: null, done: true } : applyAnswer(row.plan, row.turns, text, skipped, follow, now.toISOString());

  const patch: Record<string, unknown> = { turns: step.turns };
  if (step.done) { patch.status = 'completed'; patch.completed_at = now.toISOString(); }
  // Only the first of two quick submits wins: the update matches the turns we read.
  const upd = await getDb().from('ai_interviews').update(patch).eq('id', row.id).eq('status', 'in_progress').select('id, status, plan, turns, started_at');
  if (upd.error) return err('db_error', "Couldn't save your answer.", upd.error.message);
  const saved = (upd.data?.[0] as Row | undefined) ?? row;
  if (step.done) await logEvent({ runId: inv.assessment.run_id, jobId: inv.assessment.job_id, candidateId: inv.candidate_id, actor: 'candidate', type: 'ai_interview.completed', level: 'success', message: `${inv.firstName} finished the AI interview` });
  return ok({ state: toState(saved), done: step.done });
}

/** Writes the evidence notes for a finished interview. Never throws; leaves a plain note if the AI is not available. */
export async function summarize(interviewId: string): Promise<Result<InterviewSummary>> {
  const db = getDb();
  const q = await db.from('ai_interviews').select('id, plan, turns, invitations(candidates(full_name), assessments(jobs(title)))').eq('id', interviewId).maybeSingle();
  if (q.error || !q.data) return err('not_found', 'Interview not found.');
  const row = q.data as unknown as { id: string; turns: Turn[]; invitations: { assessments: { jobs: { title: string } | null } | null } | null };
  const answers = row.turns.filter((t) => t.role === 'candidate');
  const answered = answers.filter((t) => !t.skipped && t.text).length;
  const skipped = answers.length - answered;
  const transcript = row.turns.map((t) => `${t.role === 'ai' ? 'Interviewer' : 'Candidate'}: ${t.skipped ? '(skipped)' : t.text}`).join('\n');
  const res = await summarizeInterview({ jobTitle: row.invitations?.assessments?.jobs?.title ?? 'the role', transcript, candidateAnswers: candidateText(row.turns), answered, skipped });
  const summary: InterviewSummary = res.ok
    ? res.data.summary
    : { overview: `${answered} of ${answers.length} questions were answered. The AI notes were not available; read the transcript below.`, observations: [], probes: [], answered, skipped, aiModel: null };
  const up = await db.from('ai_interviews').update({ summary }).eq('id', interviewId);
  return up.error ? err('db_error', "Couldn't save the notes.", up.error.message) : ok(summary);
}
