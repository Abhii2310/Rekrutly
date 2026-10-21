import { CANDIDATE_STAGES, statusLabel, type Stage, type TaskType } from '@/lib/status';
import { plural } from '@/lib/format-text';

/** Pure maths and sentences for the Analytics page. Every number comes from rows passed in, nothing is estimated. */

export function median(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 === 1 ? (s[mid] as number) : ((s[mid - 1] as number) + (s[mid] as number)) / 2;
}

export function mean(values: readonly number[]): number | null {
  return values.length === 0 ? null : values.reduce((a, b) => a + b, 0) / values.length;
}

/** "under 1 min", "12 min", "1 h 5 min". */
export function formatMinutes(min: number | null): string {
  if (min === null || Number.isNaN(min)) return '–';
  if (min < 1) return 'under 1 min';
  const m = Math.round(min);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const r = m % 60;
  return r === 0 ? `${h} h` : `${h} h ${r} min`;
}

export type AnalyticsInput = {
  jobs: { id: string; title: string; is_demo: boolean }[];
  candidates: { job_id: string; stage: Stage; is_demo: boolean }[];
  assessments: { id: string; job_id: string }[];
  invitations: { id: string; assessment_id: string; created_at: string; started_at: string | null; submitted_at: string | null }[];
  submissions: {
    invitation_id: string; objective_score: number | null; objective_max: number | null; final_score: number | null; final_max: number | null;
    scoring_status: string; skill_breakdown: { skill: string; percent: number }[]; is_simulated: boolean;
  }[];
  tasks: { type: TaskType; job_id: string | null }[];
};

export type Analytics = {
  stages: { stage: Stage; count: number }[];
  totalCandidates: number;
  invited: number;
  started: number;
  submitted: number;
  completionRate: number | null;
  avgObjectivePct: number | null;
  avgFinalPct: number | null;
  skills: { skill: string; avgPct: number; submissions: number }[];
  medianMinutesToStart: number | null;
  medianMinutesToFinish: number | null;
  tasksByType: { type: TaskType; count: number }[];
  simulatedSubmissions: number;
  includesDemo: boolean;
};

const pctOf = (score: number | null, max: number | null): number | null => (score !== null && max !== null && Number(max) > 0 ? (Number(score) / Number(max)) * 100 : null);
const minutesBetween = (from: string, to: string): number => (new Date(to).getTime() - new Date(from).getTime()) / 60_000;

/** One pass over plain rows. `jobId` narrows everything to one job; null means all jobs. */
export function computeAnalytics(input: AnalyticsInput, jobId: string | null): Analytics {
  const jobs = input.jobs.filter((j) => !jobId || j.id === jobId);
  const jobIds = new Set(jobs.map((j) => j.id));
  const candidates = input.candidates.filter((c) => jobIds.has(c.job_id));
  const assessmentIds = new Set(input.assessments.filter((a) => jobIds.has(a.job_id)).map((a) => a.id));
  const invitations = input.invitations.filter((i) => assessmentIds.has(i.assessment_id));
  const invIds = new Set(invitations.map((i) => i.id));
  const submissions = input.submissions.filter((s) => invIds.has(s.invitation_id));
  const subOf = new Set(submissions.map((s) => s.invitation_id));

  const counts = new Map<Stage, number>();
  for (const c of candidates) counts.set(c.stage, (counts.get(c.stage) ?? 0) + 1);

  const started = invitations.filter((i) => i.started_at || subOf.has(i.id)).length;
  const objective = submissions.map((s) => pctOf(s.objective_score, s.objective_max)).filter((n): n is number => n !== null);
  const final = submissions.filter((s) => s.scoring_status === 'scored').map((s) => pctOf(s.final_score, s.final_max)).filter((n): n is number => n !== null);

  const bySkill = new Map<string, number[]>();
  for (const s of submissions.filter((x) => x.scoring_status === 'scored')) {
    for (const k of s.skill_breakdown ?? []) bySkill.set(k.skill, [...(bySkill.get(k.skill) ?? []), k.percent]);
  }
  const skills = [...bySkill.entries()]
    .map(([skill, ps]) => ({ skill, avgPct: Math.round(mean(ps) ?? 0), submissions: ps.length }))
    .sort((a, b) => a.skill.localeCompare(b.skill));

  const toStart = invitations.filter((i) => i.started_at).map((i) => minutesBetween(i.created_at, i.started_at as string)).filter((m) => m >= 0);
  const toFinish = invitations.filter((i) => i.started_at && i.submitted_at).map((i) => minutesBetween(i.started_at as string, i.submitted_at as string)).filter((m) => m >= 0);

  const taskCounts = new Map<TaskType, number>();
  for (const t of input.tasks.filter((x) => !jobId || x.job_id === jobId)) taskCounts.set(t.type, (taskCounts.get(t.type) ?? 0) + 1);

  const simulated = submissions.filter((s) => s.is_simulated).length;
  return {
    stages: CANDIDATE_STAGES.map((stage) => ({ stage, count: counts.get(stage) ?? 0 })),
    totalCandidates: candidates.length,
    invited: invitations.length,
    started,
    submitted: submissions.length,
    completionRate: invitations.length > 0 ? submissions.length / invitations.length : null,
    avgObjectivePct: objective.length ? Math.round(mean(objective) as number) : null,
    avgFinalPct: final.length ? Math.round(mean(final) as number) : null,
    skills,
    medianMinutesToStart: median(toStart),
    medianMinutesToFinish: median(toFinish),
    tasksByType: [...taskCounts.entries()].map(([type, count]) => ({ type, count })).sort((a, b) => b.count - a.count || a.type.localeCompare(b.type)),
    simulatedSubmissions: simulated,
    includesDemo: simulated > 0 || jobs.some((j) => j.is_demo) || candidates.some((c) => c.is_demo),
  };
}

// ---- One-sentence takeaways, written by code from the numbers ----

export function completionTakeaway(a: Pick<Analytics, 'invited' | 'submitted' | 'avgObjectivePct'>): string | null {
  if (a.invited === 0) return null;
  const head = `${a.submitted} of ${a.invited} invited ${a.invited === 1 ? 'candidate' : 'candidates'} finished.`;
  return a.avgObjectivePct === null ? head : `${head} Average objective score ${a.avgObjectivePct}%.`;
}

export function funnelTakeaway(a: Pick<Analytics, 'stages' | 'totalCandidates'>): string | null {
  if (a.totalCandidates === 0) return null;
  const parts = a.stages.filter((s) => s.count > 0).map((s) => `${s.count} ${statusLabel('candidate', s.stage).toLowerCase()}`);
  return `${plural(a.totalCandidates, 'candidate')} in the pipeline: ${parts.join(', ')}.`;
}

export function skillsTakeaway(skills: Analytics['skills']): string | null {
  if (skills.length === 0) return null;
  if (skills.length === 1) return `${(skills[0] as Analytics['skills'][number]).skill}: average ${(skills[0] as Analytics['skills'][number]).avgPct}% across ${plural((skills[0] as Analytics['skills'][number]).submissions, 'submission')}.`;
  const by = [...skills].sort((x, y) => y.avgPct - x.avgPct || x.skill.localeCompare(y.skill));
  const top = by[0] as Analytics['skills'][number];
  const low = by[by.length - 1] as Analytics['skills'][number];
  if (top.avgPct === low.avgPct) return `Every skill averaged ${top.avgPct}%.`;
  return `Candidates scored highest on ${top.skill} (${top.avgPct}%) and lowest on ${low.skill} (${low.avgPct}%).`;
}

export function speedTakeaway(a: Pick<Analytics, 'medianMinutesToStart' | 'medianMinutesToFinish'>): string[] {
  const out: string[] = [];
  if (a.medianMinutesToStart !== null) out.push(`Candidates start a median of ${formatMinutes(a.medianMinutesToStart)} after their link is created.`);
  if (a.medianMinutesToFinish !== null) out.push(`They finish a median of ${formatMinutes(a.medianMinutesToFinish)} after starting.`);
  return out;
}
