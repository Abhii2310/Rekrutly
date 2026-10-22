/**
 * Pure rules for the AI-collaboration task. The candidate gets a work task with an assistant that is sometimes wrong: in its
 * first real suggestion it states something that contradicts a fact in the brief. These rules decide what happened, from
 * the text alone, so the outcome can be checked by hand and never depends on a model's opinion.
 */

export const MAX_MESSAGES = 12;
export const MAX_MESSAGE_CHARS = 1200;
export const MAX_DELIVERABLE_CHARS = 4000;
export const TASK_MINUTES = 20;

export type Fact = { id: string; text: string };
export type Flaw = {
  factId: string;
  /** What the assistant will say that is wrong. */
  wrongStatement: string;
  /** Short strings the wrong statement contains and the brief does not, such as "30 days". */
  wrongMarkers: string[];
  /** Short strings the brief contains that the wrong statement contradicts, such as "14 days". */
  rightMarkers: string[];
  /** One plain sentence explaining the mistake, shown to the candidate afterwards. */
  why: string;
};
export type TaskDef = { title: string; brief: string; facts: Fact[]; deliverable: string; flaw: Flaw };
export type ChatMsg = { role: 'candidate' | 'assistant'; text: string; at: string };

const norm = (s: string): string => s.toLowerCase().replace(/\s+/g, ' ').trim();
export const mentionsAny = (text: string, markers: readonly string[]): boolean => {
  const t = norm(text);
  return markers.some((m) => m.trim().length > 0 && t.includes(norm(m)));
};

/** A generated task is only used if its mistake is real: the wrong marker is not in the brief, the right one is. */
export function validateTask(def: TaskDef): { ok: boolean; problems: string[] } {
  const problems: string[] = [];
  const world = `${def.brief}\n${def.facts.map((f) => f.text).join('\n')}`;
  if (def.facts.length < 3 || def.facts.length > 7) problems.push('A task needs 3 to 7 facts.');
  if (def.brief.trim().length < 80) problems.push('The brief is too short.');
  if (!def.facts.some((f) => f.id === def.flaw.factId)) problems.push('The mistake points at a fact that does not exist.');
  const wrong = def.flaw.wrongMarkers.filter((m) => m.trim().length >= 3);
  const right = def.flaw.rightMarkers.filter((m) => m.trim().length >= 2);
  if (wrong.length === 0) problems.push('There is no wrong marker.');
  if (right.length === 0) problems.push('There is no right marker.');
  if (wrong.some((m) => mentionsAny(world, [m]))) problems.push('A wrong marker appears in the brief, so it is not a contradiction.');
  // The markers are alternative spellings of the right fact; at least one must be in the brief, or the fact cannot be checked.
  if (right.length > 0 && !right.some((m) => mentionsAny(world, [m]))) problems.push('No right marker is in the brief, so it cannot be checked.');
  if (!mentionsAny(def.flaw.wrongStatement, wrong)) problems.push('The wrong statement does not contain its own marker.');
  return { ok: problems.length === 0, problems };
}

export type FlawOutcome = 'not_shown' | 'caught_and_fixed' | 'avoided_claim' | 'questioned_but_kept' | 'used_without_checking';

export const OUTCOME_LABEL: Record<FlawOutcome, string> = {
  not_shown: 'The assistant never made the mistake, so it could not be tested',
  caught_and_fixed: 'Caught the assistant’s mistake and used the correct fact',
  avoided_claim: 'Left the mistaken claim out of the final answer',
  questioned_but_kept: 'Questioned it, but the mistake is still in the final answer',
  used_without_checking: 'Used the assistant’s mistake in the final answer without checking it',
};

const CHALLENGE = /\b(wrong|incorrect|not right|isn'?t right|doesn'?t match|does not match|mismatch|actually|really\?|are you sure|double.?check|verify|source|brief says|but the|that'?s not)\b/i;

/** Did the assistant make the mistake, did the candidate push back, and what is in the final answer? */
export function flawOutcome(def: TaskDef, chat: readonly ChatMsg[], deliverable: string): { outcome: FlawOutcome; shownAt: number | null; challengedAt: number | null } {
  const shownAt = chat.findIndex((m) => m.role === 'assistant' && mentionsAny(m.text, def.flaw.wrongMarkers));
  if (shownAt < 0) return { outcome: 'not_shown', shownAt: null, challengedAt: null };
  const challengedAt = chat.findIndex((m, i) => i > shownAt && m.role === 'candidate' && (CHALLENGE.test(m.text) || mentionsAny(m.text, def.flaw.rightMarkers)));
  const wrongInFinal = mentionsAny(deliverable, def.flaw.wrongMarkers);
  const rightInFinal = mentionsAny(deliverable, def.flaw.rightMarkers);
  const at = challengedAt >= 0 ? challengedAt : null;
  if (!wrongInFinal && rightInFinal) return { outcome: 'caught_and_fixed', shownAt, challengedAt: at };
  if (!wrongInFinal) return { outcome: 'avoided_claim', shownAt, challengedAt: at };
  return { outcome: at !== null ? 'questioned_but_kept' : 'used_without_checking', shownAt, challengedAt: at };
}

export type TaskMetrics = {
  prompts: number;
  avgWords: number;
  /** Prompts that give the assistant context or constraints, not just "write it". */
  withContext: number;
  /** Prompts that ask it to check, justify or confirm something. */
  verifyAsks: number;
  /** Share of the final answer's phrases copied word for word from the assistant, 0 to 1. */
  copyShare: number;
  deliverableWords: number;
};

const CONTEXT = /\b(because|context|audience|tone|constraint|constraints|brief|customer|should|must|need|keep|under|only|based on|according to)\b/i;
const VERIFY = /\b(verify|check|source|are you sure|double.?check|confirm|justify|why|how do you know|evidence)\b/i;

const words = (s: string): string[] => norm(s).replace(/[^\p{L}\p{N}\s]/gu, ' ').split(' ').filter(Boolean);

/** Share of 6-word phrases in `final` that also appear, in order, in any assistant message. */
export function copyShare(final: string, assistantTexts: readonly string[]): number {
  const f = words(final);
  if (f.length < 6) return 0;
  const pool = new Set<string>();
  for (const t of assistantTexts) {
    const w = words(t);
    for (let i = 0; i + 6 <= w.length; i++) pool.add(w.slice(i, i + 6).join(' '));
  }
  let hit = 0;
  const total = f.length - 5;
  for (let i = 0; i < total; i++) if (pool.has(f.slice(i, i + 6).join(' '))) hit++;
  return total > 0 ? Math.round((hit / total) * 100) / 100 : 0;
}

export function taskMetrics(chat: readonly ChatMsg[], deliverable: string): TaskMetrics {
  const mine = chat.filter((m) => m.role === 'candidate');
  const counts = mine.map((m) => words(m.text).length);
  return {
    prompts: mine.length,
    avgWords: mine.length ? Math.round(counts.reduce((a, b) => a + b, 0) / mine.length) : 0,
    withContext: mine.filter((m) => words(m.text).length >= 12 || CONTEXT.test(m.text)).length,
    verifyAsks: mine.filter((m) => VERIFY.test(m.text)).length,
    copyShare: copyShare(deliverable, chat.filter((m) => m.role === 'assistant').map((m) => m.text)),
    deliverableWords: words(deliverable).length,
  };
}

export const timeIsUp = (startedAtIso: string, now: Date): boolean => now.getTime() - new Date(startedAtIso).getTime() > TASK_MINUTES * 60_000;

export type TaskReview = {
  outcome: FlawOutcome;
  label: string;
  summary: string;
  /** Exact quotes from what the candidate wrote, each with what it shows. */
  observations: { note: string; quote: string }[];
  aiModel: string | null;
};

/**
 * Tasks made by code, used when the AI cannot write one. Each has real facts in the brief and one fact the assistant will
 * contradict. They are plain on purpose: the point is the checking, not the topic.
 */
export const FALLBACK_TASKS: TaskDef[] = [
  {
    title: 'Reply to a customer about a refund',
    brief: 'A customer, Meera, bought an annual plan 9 days ago and wants her money back because the product does not support her team size. Company policy: refunds are available within 14 days of purchase, the refund is returned to the original payment method in 5 to 7 business days, and annual plans can be downgraded to a cheaper plan instead. The team is 12 people and the plan she bought supports up to 10.',
    facts: [
      { id: 'f1', text: 'Refunds are available within 14 days of purchase.' },
      { id: 'f2', text: 'Refunds go back to the original payment method in 5 to 7 business days.' },
      { id: 'f3', text: 'Meera bought 9 days ago.' },
      { id: 'f4', text: 'Her plan supports up to 10 people; her team has 12.' },
    ],
    deliverable: 'Write the reply email to Meera (under 150 words). Be warm, accurate, and tell her what happens next.',
    flaw: {
      factId: 'f1', wrongStatement: 'Our policy allows refunds within 30 days of purchase, so Meera is comfortably inside the window.',
      wrongMarkers: ['30 days', '30-day', 'thirty days'], rightMarkers: ['14 days', '14-day', 'fourteen days'],
      why: 'The brief says refunds are available within 14 days, not 30. Meera is still eligible (9 days), but the email should state the real policy.',
    },
  },
  {
    title: 'Summarise a launch update for the team',
    brief: 'You are preparing a short update for your team about last week\'s feature launch. Facts: the feature launched on Tuesday to 20 percent of users, 1,200 users tried it in the first 3 days, 4 bug reports came in (2 fixed, 2 open), and the full rollout to everyone is planned for the next release in two weeks. The goal is a clear, honest update of under 120 words.',
    facts: [
      { id: 'f1', text: 'The feature launched on Tuesday to 20 percent of users.' },
      { id: 'f2', text: '1,200 users tried it in the first 3 days.' },
      { id: 'f3', text: '4 bug reports came in: 2 fixed and 2 still open.' },
      { id: 'f4', text: 'The full rollout is planned for the next release in two weeks.' },
    ],
    deliverable: 'Write the update (under 120 words). Be clear and honest about what is done and what is still open.',
    flaw: {
      factId: 'f3', wrongStatement: 'All four bug reports have already been fixed, so there is nothing left open.',
      wrongMarkers: ['all four', 'all 4', 'nothing left open', 'all bugs are fixed', 'all of them are fixed'], rightMarkers: ['2 open', 'two open', '2 still open', 'two still open', '2 fixed', 'two fixed'],
      why: 'The brief says 2 of the 4 bugs are fixed and 2 are still open. Saying all are fixed would mislead the team.',
    },
  },
  {
    title: 'Plan a small customer interview round',
    brief: 'You need to run 5 customer interviews next week to learn why new users stop using the product after their first week. Facts: the budget is 3,000 rupees in total for thank-you vouchers, each interview is 30 minutes, you can only interview customers who signed up in the last 60 days, and the interviews must finish by Friday. Customers who agreed to be contacted are in the "opted-in" list.',
    facts: [
      { id: 'f1', text: 'Total budget for vouchers is 3,000 rupees.' },
      { id: 'f2', text: 'Each interview is 30 minutes.' },
      { id: 'f3', text: 'Only customers who signed up in the last 60 days can be interviewed.' },
      { id: 'f4', text: 'Interviews must finish by Friday, and only opted-in customers may be contacted.' },
    ],
    deliverable: 'Write a short plan (under 150 words): who to invite, how many, the voucher amount per person, and the schedule.',
    flaw: {
      factId: 'f3', wrongStatement: 'You can interview customers who signed up in the last 6 months, which gives you a much larger pool.',
      wrongMarkers: ['6 months', 'six months', 'last 180 days'], rightMarkers: ['60 days', '60-day', 'sixty days'],
      why: 'The brief limits interviews to customers who signed up in the last 60 days, not 6 months.',
    },
  },
];
