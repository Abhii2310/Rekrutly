import type { ShortAnswerGrade } from '@/lib/ai/schemas';

export type CheckedGrade = Omit<ShortAnswerGrade, 'evidence_quote'> & { evidence_quote: string | null };

/** Keeps a score between 0 and the question's maximum. */
export const clampScore = (score: number, max: number): number => {
  if (!Number.isFinite(score)) return 0;
  return Math.min(Math.max(score, 0), max);
};

/** True when the quote is an exact piece of the candidate's answer (ignoring only the whitespace around it). */
export const isExactQuote = (quote: string, answer: string): boolean => {
  const q = quote.trim();
  return q.length > 0 && answer.includes(q);
};

const LOWER: Record<ShortAnswerGrade['confidence'], ShortAnswerGrade['confidence']> = { high: 'low', medium: 'low', low: 'low' };

/**
 * Pure. The model is never trusted alone: the score is clamped to [0, max]; if the evidence quote is not an exact
 * substring of the answer it is removed and confidence drops to low.
 */
export function checkGrade(grade: ShortAnswerGrade, answer: string, maxScore: number): CheckedGrade {
  // A too-long quote is cut to 300 characters. A prefix of an exact piece of the answer is still an exact piece.
  const quote = grade.evidence_quote.trim().slice(0, 300).trim();
  const valid = isExactQuote(quote, answer);
  return {
    ...grade,
    reasoning: grade.reasoning.slice(0, 400),
    score: Math.round(clampScore(grade.score, maxScore) * 100) / 100,
    evidence_quote: valid ? quote : null,
    confidence: valid ? grade.confidence : LOWER[grade.confidence],
  };
}
