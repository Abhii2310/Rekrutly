import { describe, expect, it } from 'vitest';
import { aggregate, effectiveScore, type AggQuestion, type AggScore } from '@/lib/scoring/aggregate';
import { checkGrade, clampScore, isExactQuote } from '@/lib/scoring/grade-rules';
import { checkReport } from '@/lib/scoring/report-rules';
import type { CandidateReport, ShortAnswerGrade } from '@/lib/ai/schemas';

const Q: AggQuestion[] = [
  { id: 'a', skill: 'React', type: 'mcq', max_score: 2 },
  { id: 'b', skill: 'React', type: 'mcq', max_score: 2 },
  { id: 'c', skill: 'SQL', type: 'mcq', max_score: 1 },
  { id: 'd', skill: 'SQL', type: 'short', max_score: 6 },
  { id: 'e', skill: 'Debugging', type: 'short', max_score: 6 },
];
const S = (question_id: string, method: AggScore['method'], score: number, max_score: number, overridden_score: number | null = null): AggScore => ({ question_id, method, score, max_score, overridden_score });

describe('aggregate', () => {
  const scores = [S('a', 'auto', 2, 2), S('b', 'auto', 0, 2), S('c', 'auto', 1, 1), S('d', 'ai_suggested', 4, 6), S('e', 'auto', 0, 6)];

  it('splits objective, AI-suggested and final totals', () => {
    const r = aggregate(Q, scores);
    expect(r.objective).toEqual({ score: 3, max: 5 });
    // The written section counts every written question that has a score row, graded by the AI or empty (0).
    expect(r.ai).toEqual({ score: 4, max: 12 });
    expect(r.final).toEqual({ score: 7, max: 17 });
  });
  it('uses overrides in the final total and the skill breakdown only', () => {
    const r = aggregate(Q, [...scores.slice(0, 3), S('d', 'ai_suggested', 4, 6, 6), scores[4] as AggScore]);
    expect(r.ai.score).toBe(4); // the AI suggestion itself is unchanged
    expect(r.final.score).toBe(9);
    expect(r.skill_breakdown.find((s) => s.skill === 'SQL')).toMatchObject({ score: 7, max: 7, percent: 100 });
  });
  it('builds a per-skill breakdown with whole-number percentages and question ids', () => {
    const r = aggregate(Q, scores);
    expect(r.skill_breakdown.map((s) => [s.skill, s.score, s.max, s.percent])).toEqual([
      ['React', 2, 4, 50], ['SQL', 5, 7, 71], ['Debugging', 0, 6, 0],
    ]);
    expect(r.skill_breakdown[0]?.question_ids).toEqual(['a', 'b']);
  });
  it('ignores questions without a score row and scores for unknown questions', () => {
    const r = aggregate(Q, [S('a', 'auto', 2, 2), S('zzz', 'auto', 9, 9)]);
    expect(r.final).toEqual({ score: 2, max: 2 });
    expect(r.ai).toEqual({ score: 0, max: 0 });
  });
  it('handles nothing scored yet', () => {
    expect(aggregate(Q, [])).toEqual({ objective: { score: 0, max: 0 }, ai: { score: 0, max: 0 }, final: { score: 0, max: 0 }, skill_breakdown: [] });
  });
  it('effectiveScore prefers the override, including an override of zero', () => {
    expect(effectiveScore({ score: 4, overridden_score: null })).toBe(4);
    expect(effectiveScore({ score: 4, overridden_score: 0 })).toBe(0);
  });
});

describe('grade checks', () => {
  const grade: ShortAnswerGrade = { score: 5, matched_criteria: ['a'], missing_criteria: ['b'], evidence_quote: 'index the column', reasoning: 'r', confidence: 'high' };
  const answer = 'I would index the column and check the query plan.';

  it('clamps the score into [0, max]', () => {
    expect(clampScore(9, 6)).toBe(6);
    expect(clampScore(-3, 6)).toBe(0);
    expect(clampScore(Number.NaN, 6)).toBe(0);
    expect(clampScore(4.5, 6)).toBe(4.5);
    expect(checkGrade({ ...grade, score: 99 }, answer, 6).score).toBe(6);
  });
  it('keeps an exact quote and its confidence', () => {
    expect(checkGrade(grade, answer, 6)).toMatchObject({ evidence_quote: 'index the column', confidence: 'high' });
    expect(checkGrade({ ...grade, evidence_quote: '  index the column  ' }, answer, 6).evidence_quote).toBe('index the column');
  });
  it('drops a quote that is not in the answer and lowers confidence to low', () => {
    const r = checkGrade({ ...grade, evidence_quote: 'create a covering index' }, answer, 6);
    expect(r.evidence_quote).toBeNull();
    expect(r.confidence).toBe('low');
  });
  it('cuts an over-long quote to 300 characters and keeps it only if it is still exact', () => {
    const long = 'word '.repeat(200);
    const r = checkGrade({ ...grade, evidence_quote: long }, long, 6);
    expect(r.evidence_quote?.length).toBeLessThanOrEqual(300);
    expect(long.includes(r.evidence_quote ?? '#')).toBe(true);
    expect(checkGrade({ ...grade, reasoning: 'x'.repeat(900) }, answer, 6).reasoning).toHaveLength(400);
  });
  it('treats a paraphrase, an empty quote and a different case as not exact', () => {
    expect(isExactQuote('INDEX THE COLUMN', answer)).toBe(false);
    expect(isExactQuote('', answer)).toBe(false);
    expect(isExactQuote('indexing the column', answer)).toBe(false);
  });
});

describe('report checks', () => {
  const ctx = {
    skills: ['React', 'SQL', 'Debugging'],
    weakestSkill: 'Debugging',
    evidenceBySkill: { SQL: ['Wrote: "I would index the column"'], React: ['Answered 2 of 2 correctly'], Debugging: [] },
  };
  const report = (over: Partial<CandidateReport>): CandidateReport => ({
    summary: 's', strengths: [], gaps: [], missing_evidence: [],
    interview_questions: [1, 2, 3].map((n) => ({ skill: 'SQL', question: `q${n}`, what_good_looks_like: 'w' })), ...over,
  });

  it('keeps evidence that appears in the provided evidence', () => {
    const r = checkReport(report({ strengths: [{ skill: 'SQL', evidence: 'I would index the column' }] }), ctx);
    expect(r.strengths).toEqual([{ skill: 'SQL', evidence: 'I would index the column' }]);
  });
  it('replaces invented evidence with the real evidence for that skill, or drops the item', () => {
    const r = checkReport(report({ strengths: [{ skill: 'SQL', evidence: 'Clearly an expert' }], gaps: [{ skill: 'Debugging', evidence: 'Cannot debug' }] }), ctx);
    expect(r.strengths[0]?.evidence).toBe('Wrote: "I would index the column"');
    expect(r.gaps).toEqual([]); // no real evidence exists for Debugging
  });
  it('drops items for skills that are not in the job or assessment, and renames close matches', () => {
    const r = checkReport(report({ strengths: [{ skill: 'Kubernetes', evidence: 'x' }, { skill: 'react', evidence: 'Answered 2 of 2 correctly' }] }), ctx);
    expect(r.strengths).toEqual([{ skill: 'React', evidence: 'Answered 2 of 2 correctly' }]);
  });
  it('keeps the interview question count and relabels unknown skills with the weakest one', () => {
    const r = checkReport(report({ interview_questions: [
      { skill: 'sql', question: 'a', what_good_looks_like: 'w' }, { skill: 'Rust', question: 'b', what_good_looks_like: 'w' }, { skill: 'React', question: 'c', what_good_looks_like: 'w' },
    ] }), ctx);
    expect(r.interview_questions.map((q) => q.skill)).toEqual(['SQL', 'Debugging', 'React']);
  });
});
