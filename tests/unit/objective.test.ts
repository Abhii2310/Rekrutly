import { describe, expect, it } from 'vitest';
import { scoreObjective, type ScorableQuestion } from '@/lib/scoring/objective';

const qs: ScorableQuestion[] = [
  { id: 'q1', type: 'mcq', max_score: 1, correct_option: 0 },
  { id: 'q2', type: 'mcq', max_score: 2, correct_option: 3 },
  { id: 'q3', type: 'mcq', max_score: 2, correct_option: 1 },
  { id: 'q4', type: 'short', max_score: 6, correct_option: null },
];

describe('scoreObjective', () => {
  it('gives max for correct, 0 for wrong, and flags unanswered', () => {
    const r = scoreObjective(qs, [
      { question_id: 'q1', selected_option: 0 },
      { question_id: 'q2', selected_option: 2 },
    ]);
    expect(r.scores).toEqual([
      { question_id: 'q1', score: 1, max_score: 1, is_correct: true, unanswered: false },
      { question_id: 'q2', score: 0, max_score: 2, is_correct: false, unanswered: false },
      { question_id: 'q3', score: 0, max_score: 2, is_correct: false, unanswered: true },
    ]);
    expect(r.total).toBe(1);
    expect(r.max).toBe(5);
  });
  it('treats a null selection as unanswered', () => {
    const r = scoreObjective(qs, [{ question_id: 'q1', selected_option: null }]);
    expect(r.scores[0]).toMatchObject({ score: 0, unanswered: true, is_correct: false });
  });
  it('skips written questions entirely', () => {
    const r = scoreObjective(qs, [{ question_id: 'q4', selected_option: null }]);
    expect(r.scores.map((s) => s.question_id)).toEqual(['q1', 'q2', 'q3']);
  });
  it('scores a perfect and an empty submission', () => {
    const all = scoreObjective(qs, [{ question_id: 'q1', selected_option: 0 }, { question_id: 'q2', selected_option: 3 }, { question_id: 'q3', selected_option: 1 }]);
    expect(all.total).toBe(5);
    expect(scoreObjective(qs, []).total).toBe(0);
  });
  it('ignores answers for questions that do not exist and handles no multiple-choice at all', () => {
    expect(scoreObjective(qs, [{ question_id: 'nope', selected_option: 0 }]).total).toBe(0);
    expect(scoreObjective([qs[3] as ScorableQuestion], [])).toEqual({ scores: [], total: 0, max: 0 });
  });
});
