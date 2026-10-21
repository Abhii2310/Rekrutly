import type { DetailQuestion } from '@/lib/db/queries/submission';
import { err, ok, type Result } from '@/lib/result';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const MIN_COMPARE = 2;
export const MAX_COMPARE = 4;

/** Pure. `?s=a,b,c` becomes 2 to 4 distinct submission IDs, in the order given, or a plain-language error. */
export function parseCompareIds(param: string | undefined): Result<string[]> {
  const ids = [...new Set((param ?? '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean))];
  if (ids.length === 0) return err('no_selection', 'Choose two to four candidates on a results page, then press Compare.');
  if (ids.some((id) => !UUID.test(id))) return err('invalid_selection', 'That comparison link is not valid.');
  if (ids.length < MIN_COMPARE) return err('too_few', 'Pick at least two candidates to compare.');
  if (ids.length > MAX_COMPARE) return err('too_many', `Compare up to ${MAX_COMPARE} candidates at a time.`);
  return ok(ids);
}

export const minutesTaken = (startedAt: string | null, submittedAt: string): number | null => {
  if (!startedAt) return null;
  const m = (new Date(submittedAt).getTime() - new Date(startedAt).getTime()) / 60_000;
  return m >= 0 ? m : null;
};

const effective = (q: DetailQuestion): number => (q.score ? (q.score.overridden_score ?? q.score.score) : 0);

export type Evidence = { quote: string | null; question: string; score: number; max: number };

/**
 * The written answer for `skill` that scored highest among those with a verified quote (the exact words the grader pointed
 * to). If none has a quote, the best written answer is returned without one, so the page never says "no written answer"
 * when there was one. Null only when the skill has no written answer.
 */
export function strongestEvidence(questions: readonly DetailQuestion[], skill: string): Evidence | null {
  const written = questions
    .filter((q) => q.skill === skill && q.type === 'short' && q.score && !q.score.unanswered)
    .sort((a, b) => effective(b) / b.max_score - effective(a) / a.max_score || a.position - b.position);
  const q = written.find((w) => w.score?.evidence_quote?.trim()) ?? written[0];
  if (!q || !q.score) return null;
  const quote = q.score.evidence_quote?.trim() || null;
  return { quote, question: q.prompt.split('\n')[0]?.trim() ?? q.prompt, score: effective(q), max: q.max_score };
}

/** "3 of 4 correct" for the multiple-choice questions of a skill, or null when it has none. */
export function mcqSummary(questions: readonly DetailQuestion[], skill: string): { correct: number; total: number } | null {
  const mcq = questions.filter((q) => q.skill === skill && q.type === 'mcq');
  if (mcq.length === 0) return null;
  return { correct: mcq.filter((q) => q.score?.is_correct).length, total: mcq.length };
}

export const truncate = (text: string, max: number): string => (text.length <= max ? text : `${text.slice(0, max).replace(/\s+\S*$/, '')}…`);
