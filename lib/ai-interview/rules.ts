/** Pure rules for the AI interview: the question plan, the conversation as a list of turns, and what comes next. */

export const MAIN_QUESTIONS = 4;
export const MAX_ANSWER_CHARS = 2000;
export const INTERVIEW_MINUTES = 25;
export const MAX_TURNS = 16;

export type PlanQuestion = { question: string; topic: string; basis: 'resume' | 'assessment' | 'role' };
export type Turn = { role: 'ai' | 'candidate'; kind: 'question' | 'followup' | 'answer'; qi: number; text: string; at: string; skipped?: boolean };

/** The last thing the AI said, if the candidate has not answered it yet. */
export function currentPrompt(turns: readonly Turn[]): Turn | null {
  const last = turns[turns.length - 1];
  return last && last.role === 'ai' ? last : null;
}

export const askedMain = (turns: readonly Turn[]): number => turns.filter((t) => t.role === 'ai' && t.kind === 'question').length;

const VAGUE = /^(i )?(don'?t|do not) know\b|^no idea\b|^not sure\b|^pass\b|^skip\b|^nothing\b/i;

/** Too short or empty to dig into. A follow-up would only make the candidate feel stuck. */
export const isVague = (answer: string): boolean => answer.trim().length < 40 || VAGUE.test(answer.trim());

export type Step = { turns: Turn[]; next: Turn | null; done: boolean };

/**
 * Adds the candidate's answer, then the next thing the AI says: the follow-up if there is one and the answer was worth
 * digging into, otherwise the next planned question, otherwise the interview is done. `followup` comes from the AI and may be null.
 */
export function applyAnswer(plan: readonly PlanQuestion[], turns: readonly Turn[], answer: string, skipped: boolean, followup: string | null, nowIso: string): Step {
  const prompt = currentPrompt(turns);
  if (!prompt) return { turns: [...turns], next: null, done: false };
  const text = skipped ? '' : answer.trim().slice(0, MAX_ANSWER_CHARS);
  const out: Turn[] = [...turns, { role: 'candidate', kind: 'answer', qi: prompt.qi, text, at: nowIso, ...(skipped ? { skipped: true } : {}) }];

  const canDig = prompt.kind === 'question' && !skipped && !isVague(text) && followup !== null && followup.trim().length >= 8;
  if (canDig && out.length < MAX_TURNS) {
    const next: Turn = { role: 'ai', kind: 'followup', qi: prompt.qi, text: (followup as string).trim().slice(0, 300), at: nowIso };
    return { turns: [...out, next], next, done: false };
  }
  const index = askedMain(out);
  const q = plan[index];
  if (!q || out.length >= MAX_TURNS) return { turns: out, next: null, done: true };
  const next: Turn = { role: 'ai', kind: 'question', qi: index, text: q.question, at: nowIso };
  return { turns: [...out, next], next, done: false };
}

/** The first question, to start a new interview. */
export function firstTurn(plan: readonly PlanQuestion[], nowIso: string): Turn | null {
  const q = plan[0];
  return q ? { role: 'ai', kind: 'question', qi: 0, text: q.question, at: nowIso } : null;
}

/** Whether the time is up, counted by the server from when the interview started. */
export const timeIsUp = (startedAtIso: string, now: Date): boolean => now.getTime() - new Date(startedAtIso).getTime() > INTERVIEW_MINUTES * 60_000;

export const candidateText = (turns: readonly Turn[]): string => turns.filter((t) => t.role === 'candidate' && !t.skipped).map((t) => t.text).join('\n');

/**
 * Questions made by code, used when the AI is not available. They still use the role's skills and the candidate's weakest
 * areas, so the interview does not break when the AI does.
 */
export function fallbackPlan(input: { jobTitle: string; skills: readonly string[]; weakSkills: readonly string[]; hasResume: boolean }): PlanQuestion[] {
  const pool = [...input.weakSkills, ...input.skills].filter((s, i, a) => s && a.indexOf(s) === i);
  const q: PlanQuestion[] = [
    { question: `Tell me about a project you are proud of that is close to the ${input.jobTitle} role. What was your own part in it?`, topic: 'Experience', basis: input.hasResume ? 'resume' : 'role' },
  ];
  for (const skill of pool.slice(0, 2)) {
    q.push({ question: `Talk me through how you would approach ${skill} on a real project. Where have you used it, and what did you learn?`, topic: skill, basis: 'assessment' });
  }
  q.push({ question: 'Tell me about a time something went wrong in your work. What did you do, and what would you change?', topic: 'Problem solving', basis: 'role' });
  return q.slice(0, MAIN_QUESTIONS);
}

export type InterviewSummary = {
  overview: string;
  observations: { area: string; note: string; quote: string }[];
  probes: string[];
  answered: number;
  skipped: number;
  aiModel: string | null;
};
