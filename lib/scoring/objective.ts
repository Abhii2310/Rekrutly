export type ScorableQuestion = { id: string; type: 'mcq' | 'short'; max_score: number; correct_option: number | null };
export type GivenAnswer = { question_id: string; selected_option: number | null };

export type ObjectiveScore = {
  question_id: string;
  score: number;
  max_score: number;
  is_correct: boolean;
  unanswered: boolean;
};

/**
 * Pure. Multiple-choice only: correct gives max_score, wrong gives 0, unanswered gives 0 and is flagged.
 * Written questions are skipped here; they are graded later and labelled as AI-suggested.
 */
export function scoreObjective(questions: readonly ScorableQuestion[], answers: readonly GivenAnswer[]): { scores: ObjectiveScore[]; total: number; max: number } {
  const byQuestion = new Map(answers.map((a) => [a.question_id, a.selected_option]));
  const scores: ObjectiveScore[] = [];
  for (const q of questions) {
    if (q.type !== 'mcq') continue;
    const chosen = byQuestion.get(q.id) ?? null;
    const unanswered = chosen === null;
    const is_correct = !unanswered && q.correct_option !== null && chosen === q.correct_option;
    scores.push({ question_id: q.id, score: is_correct ? q.max_score : 0, max_score: q.max_score, is_correct, unanswered });
  }
  return {
    scores,
    total: scores.reduce((a, s) => a + s.score, 0),
    max: scores.reduce((a, s) => a + s.max_score, 0),
  };
}
