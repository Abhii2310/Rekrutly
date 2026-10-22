import type { GuardrailFlag } from '@/lib/guardrails/protected';
import type { Stage } from '@/lib/status';
import type { PlannerOutput } from './schemas';

export type PlannerJob = { id: string; title: string; skills: string[] };
export type PlannerCandidate = { id: string; job_id: string; name: string; stage: Stage; has_email: boolean; skills: string[] };
export type PlannerContext = { jobs: PlannerJob[]; candidates: PlannerCandidate[]; selectedJobId: string | null };

export type Clarification = { field: string; question: string; blocking: boolean };

export type ResolvedAssessment = NonNullable<PlannerOutput['assessment']>;

/** What is stored in `workflow_runs.plan` and shown to the recruiter. Built from validated, real data. */
export type ResolvedPlan = {
  intent: PlannerOutput['intent'];
  job: { id: string; title: string } | null;
  candidates: { id: string; name: string; has_email: boolean }[];
  assessment: ResolvedAssessment | null;
  preview_before_invite: boolean;
  summary: string;
  assumptions: string[];
  guardrail_flags: GuardrailFlag[];
  clarifications: Clarification[];
  /** True when the plan came from the saved demo plan instead of the AI. Shown as a "Saved" pill. */
  fallback?: boolean;
};

export const DEFAULTS = { question_count: 10, duration_minutes: 30 } as const;

const NUMBER_WORDS: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  eleven: 11, twelve: 12, fifteen: 15, twenty: 20,
};
const NUM = String.raw`(\d{1,3}|${Object.keys(NUMBER_WORDS).join('|')})`;

function toNumber(s: string | undefined): number | null {
  if (!s) return null;
  const n = /^\d+$/.test(s) ? Number(s) : NUMBER_WORDS[s.toLowerCase()];
  return n ?? null;
}

const firstNumber = (re: RegExp, text: string): number | null => toNumber(re.exec(text)?.[1]);

export const statedCandidateCount = (t: string): number | null => firstNumber(new RegExp(String.raw`\b${NUM}\s+(?:of\s+the\s+)?(?:[a-z-]+\s+)?candidates?\b`, 'i'), t);
export const statedQuestionCount = (t: string): number | null => firstNumber(new RegExp(String.raw`\b${NUM}[\s-]+(?:[a-z-]+\s+)?questions?\b`, 'i'), t);
export const statedDuration = (t: string): number | null => {
  const min = firstNumber(new RegExp(String.raw`\b${NUM}[\s-]*(?:minutes?|mins?)\b`, 'i'), t);
  if (min) return min;
  const hr = firstNumber(new RegExp(String.raw`\b${NUM}[\s-]*(?:hours?|hrs?)\b`, 'i'), t);
  return hr ? hr * 60 : null;
};

const mentionsTypes = (t: string): boolean => /\b(mcq|multiple[- ]choice|short[- ]answer|written|essay|coding)\b/i.test(t);
const mentionsDifficulty = (t: string): boolean => /\b(easy|medium|hard|difficult|beginner|advanced|entry[- ]level)\b/i.test(t);
const wantsPreview = (t: string): boolean => /before (inviting|sending|you invite|anyone)|show me the questions|ask me before|let me (see|review)/i.test(t);

function mergeFlags(code: GuardrailFlag[], model: GuardrailFlag[]): GuardrailFlag[] {
  const out: GuardrailFlag[] = [];
  const overlaps = (a: string, b: string): boolean => a.includes(b) || b.includes(a);
  // Code flags come first so their standard wording wins over the model's for the same phrase.
  for (const f of [...code, ...model]) {
    const k = f.phrase.trim().toLowerCase();
    // The model sometimes flags our own [removed] placeholder; it is not something the recruiter typed.
    if (!k || k.includes('[removed]')) continue;
    if (out.some((o) => overlaps(o.phrase.trim().toLowerCase(), k))) continue;
    out.push(f);
  }
  return out;
}

/**
 * Pure. Turns the model's proposal into a plan made only of real IDs and sane defaults:
 * unknown IDs are dropped, the "these five" rule and defaults are applied, guardrail flags are merged.
 */
export function resolvePlan(
  raw: PlannerOutput,
  context: PlannerContext,
  instruction: string,
  codeFlags: GuardrailFlag[] = [],
): { plan: ResolvedPlan; clarifications: Clarification[]; assumptions: string[] } {
  const assumptions: string[] = [];
  const clarifications: Clarification[] = [];
  const flags = mergeFlags(codeFlags, raw.guardrail_flags);

  const base = {
    guardrail_flags: flags,
    preview_before_invite: raw.preview_before_invite || wantsPreview(instruction),
    summary: raw.summary.trim(),
  };

  if (raw.intent === 'unsupported') {
    const plan: ResolvedPlan = { ...base, intent: 'unsupported', job: null, candidates: [], assessment: null, assumptions, clarifications };
    return { plan, clarifications, assumptions };
  }

  const job =
    context.jobs.find((j) => j.id === raw.job_id) ??
    context.jobs.find((j) => j.id === context.selectedJobId) ??
    null;

  if (raw.intent === 'follow_up_sweep') {
    const plan: ResolvedPlan = {
      ...base, intent: 'follow_up_sweep', job: job ? { id: job.id, title: job.title } : null,
      candidates: [], assessment: null, assumptions, clarifications,
    };
    return { plan, clarifications, assumptions };
  }

  // ---- create_assessment_workflow ----
  if (!job) {
    const asked = raw.clarifications.find((c) => c.field === 'job');
    clarifications.push({ field: 'job', question: asked?.question ?? 'Which job is this for?', blocking: true });
  }

  const pool = job ? context.candidates.filter((c) => c.job_id === job.id) : [];
  const poolById = new Map(pool.map((c) => [c.id, c]));
  const kept = raw.candidate_ids.filter((id) => poolById.has(id));
  const dropped = raw.candidate_ids.length - kept.length;
  if (dropped > 0) {
    clarifications.push({
      field: 'candidates',
      question: `I couldn't match ${dropped} ${dropped === 1 ? 'candidate' : 'candidates'} to this job, so I left them out.`,
      blocking: false,
    });
  }

  const applied = pool.filter((c) => c.stage === 'applied');
  const stated = statedCandidateCount(instruction);
  let chosen = kept.map((id) => poolById.get(id)).filter((c): c is PlannerCandidate => Boolean(c));
  if (stated !== null && applied.length === stated && chosen.length !== stated) {
    chosen = applied; // "these five" with exactly five new candidates
  } else if (chosen.length === 0 && applied.length > 0) {
    chosen = applied;
    assumptions.push(`Used all ${applied.length} new ${applied.length === 1 ? 'candidate' : 'candidates'} in this job.`);
  }
  chosen = chosen.slice(0, 50);
  if (job && chosen.length === 0) {
    clarifications.push({ field: 'candidates', question: 'Which candidates should take the assessment?', blocking: true });
  }

  const a = raw.assessment;
  let assessment: ResolvedAssessment | null = null;
  if (job) {
    const count = statedQuestionCount(instruction);
    const minutes = statedDuration(instruction);
    if (count === null) assumptions.push(`${DEFAULTS.question_count} questions (not stated).`);
    if (minutes === null) assumptions.push(`${DEFAULTS.duration_minutes} minutes (not stated).`);
    const skills = (a?.skills.length ? a.skills : job.skills).slice(0, 8);
    assessment = {
      title: a?.title ?? `${job.title} assessment`,
      question_count: count === null ? DEFAULTS.question_count : (a?.question_count ?? count),
      duration_minutes: minutes === null ? DEFAULTS.duration_minutes : (a?.duration_minutes ?? minutes),
      skills: skills.length ? skills : ['General'],
      question_types: a && mentionsTypes(instruction) ? a.question_types : ['mcq', 'short'],
      difficulty: a && mentionsDifficulty(instruction) ? a.difficulty : 'mixed',
    };
  }

  const plan: ResolvedPlan = {
    ...base,
    intent: 'create_assessment_workflow',
    job: job ? { id: job.id, title: job.title } : null,
    candidates: chosen.map((c) => ({ id: c.id, name: c.name, has_email: c.has_email })),
    assessment,
    assumptions: assumptions.slice(0, 5),
    clarifications,
  };
  return { plan, clarifications, assumptions: plan.assumptions };
}

export const blockingClarifications = (cs: Clarification[]): Clarification[] => cs.filter((c) => c.blocking);

/**
 * Pure. When the recruiter ticked people on the Candidates page, those people replace whatever the model picked. Only people
 * in the plan's job count, and the plan is never allowed to widen beyond the selection. Returns the number used.
 */
export function applySelectedCandidates(
  plan: ResolvedPlan, clarifications: Clarification[], context: PlannerContext, ids: string[],
): number {
  if (plan.intent !== 'create_assessment_workflow' || !plan.job) return 0;
  const jobId = plan.job.id;
  const byId = new Map(context.candidates.filter((c) => c.job_id === jobId).map((c) => [c.id, c]));
  const chosen = [...new Set(ids)].map((id) => byId.get(id)).filter((c): c is PlannerCandidate => Boolean(c)).slice(0, 50);
  if (chosen.length === 0) return 0;
  plan.candidates = chosen.map((c) => ({ id: c.id, name: c.name, has_email: c.has_email }));
  plan.assumptions = [`Only the ${chosen.length} ${chosen.length === 1 ? 'person' : 'people'} you selected.`, ...plan.assumptions.filter((a) => !/new candidates? in this job/.test(a))].slice(0, 5);
  plan.clarifications = plan.clarifications.filter((c) => c.field !== 'candidates');
  for (let i = clarifications.length - 1; i >= 0; i--) if (clarifications[i]?.field === 'candidates') clarifications.splice(i, 1);
  return chosen.length;
}
