import { describe, expect, it } from 'vitest';
import { balanceTypes, estimateMinutes, leastCoveredFirst, placeCorrect, pointsFor, postValidate, rng, skillQuotas, splitTypes, spreadCorrectAnswers } from '@/lib/ai/question-rules';
import type { GeneratedQuestion } from '@/lib/ai/schemas';

const mcq = (n: number, skill = 'React', correct = 0): GeneratedQuestion => ({
  type: 'mcq', prompt: `Question number ${n} about ${skill}?`, options: [`right ${n}`, `wrong a ${n}`, `wrong b ${n}`, `wrong c ${n}`],
  correct_option: correct, explanation: 'because', skill, difficulty: 'medium', max_score: 1,
});
const short = (n: number, skill = 'SQL'): GeneratedQuestion => ({
  type: 'short', prompt: `Explain short topic ${n} in a few sentences.`, rubric: { criteria: [{ point: 'a', weight: 1 }, { point: 'b', weight: 1 }], model_answer: 'm' },
  skill, difficulty: 'hard', max_score: 2,
});
const SKILLS = ['React', 'APIs', 'SQL', 'Debugging'];

describe('splitTypes', () => {
  it('splits 70/30 by default', () => {
    expect(splitTypes(10, ['mcq', 'short'])).toEqual({ mcq: 7, short: 3 });
    expect(splitTypes(3, ['mcq', 'short'])).toEqual({ mcq: 2, short: 1 });
  });
  it('honours a single type', () => {
    expect(splitTypes(10, ['mcq'])).toEqual({ mcq: 10, short: 0 });
    expect(splitTypes(6, ['short'])).toEqual({ mcq: 0, short: 6 });
  });
});

describe('skillQuotas and points', () => {
  it('spreads counts evenly, remainder first', () => {
    expect(skillQuotas(10, SKILLS).map((q) => q.count)).toEqual([3, 3, 2, 2]);
    expect(skillQuotas(10, SKILLS).reduce((a, q) => a + q.count, 0)).toBe(10);
  });
  it('sets points by type and difficulty', () => {
    expect(pointsFor('mcq', 'easy')).toBe(1);
    expect(pointsFor('mcq', 'hard')).toBe(2);
    expect(pointsFor('short', 'easy')).toBe(4);
    expect(pointsFor('short', 'hard')).toBe(6);
  });
  it('estimates minutes', () => {
    expect(estimateMinutes([mcq(1), mcq(2), short(1)])).toBe(6);
  });
});

describe('placeCorrect and spreadCorrectAnswers', () => {
  it('keeps the right option text at the new index', () => {
    const opts = ['a', 'b', 'c', 'd'];
    for (let correct = 0; correct < 4; correct++) {
      for (let target = 0; target < 4; target++) {
        const r = placeCorrect(opts, correct, target, rng(`s${correct}${target}`));
        expect(r.options[r.correct_option]).toBe(opts[correct]);
        expect([...r.options].sort()).toEqual(['a', 'b', 'c', 'd']);
      }
    }
  });
  it('spreads correct answers over every position and keeps each answer correct', () => {
    const qs = Array.from({ length: 8 }, (_, i) => mcq(i));
    const out = spreadCorrectAnswers(qs, 'seed');
    const counts = [0, 0, 0, 0];
    out.forEach((q, i) => {
      if (q.type !== 'mcq') throw new Error('type');
      expect(q.options[q.correct_option]).toBe(`right ${i}`);
      counts[q.correct_option] = (counts[q.correct_option] ?? 0) + 1;
    });
    expect(counts).toEqual([2, 2, 2, 2]);
  });
  it('is deterministic for a seed and leaves short questions alone', () => {
    const qs = [mcq(1), short(1), mcq(2)];
    expect(spreadCorrectAnswers(qs, 'x')).toEqual(spreadCorrectAnswers(qs, 'x'));
    expect(spreadCorrectAnswers(qs, 'x')[1]).toEqual(qs[1]);
  });
});

describe('postValidate', () => {
  const base = { skills: SKILLS, durationMinutes: 30, seed: 's' };

  it('trims extras to the exact count', () => {
    const qs = Array.from({ length: 12 }, (_, i) => mcq(i, SKILLS[i % 4]));
    const r = postValidate(qs, { ...base, count: 10 });
    expect(r.questions).toHaveLength(10);
    expect(r.shortfall).toBe(0);
  });
  it('reports a shortfall', () => {
    const r = postValidate([mcq(1), mcq(2, 'APIs')], { ...base, count: 10 });
    expect(r.questions).toHaveLength(2);
    expect(r.shortfall).toBe(8);
  });
  it('drops skills that were not requested, normalises close matches, and warns', () => {
    const r = postValidate([mcq(1, 'react'), mcq(2, 'REST APIs'), mcq(3, 'Kubernetes')], { ...base, count: 3 });
    expect(r.questions.map((q) => q.skill)).toEqual(['React', 'APIs']);
    expect(r.shortfall).toBe(1);
    expect(r.warnings.join(' ')).toMatch(/1 question was dropped/);
  });
  it('removes duplicate prompts', () => {
    const r = postValidate([mcq(1), mcq(1), mcq(2)], { ...base, count: 3 });
    expect(r.questions).toHaveLength(2);
  });
  it('sets points in code, ignoring the model', () => {
    const r = postValidate([{ ...mcq(1), max_score: 5 }, { ...short(1), max_score: 10 }], { ...base, count: 2 });
    expect(r.questions.map((q) => q.max_score)).toEqual([2, 6]);
  });
  it('keeps the right answer correct after spreading', () => {
    const r = postValidate(Array.from({ length: 4 }, (_, i) => mcq(i, SKILLS[i], 2)), { ...base, count: 4 });
    r.questions.forEach((q, i) => {
      if (q.type === 'mcq') expect(q.options[q.correct_option]).toBe(`wrong b ${i}`);
    });
  });
  it('warns when questions will not fit the time limit', () => {
    const qs = Array.from({ length: 10 }, (_, i) => short(i, SKILLS[i % 4]));
    const r = postValidate(qs, { ...base, count: 10, durationMinutes: 30 });
    expect(r.warnings.join(' ')).toMatch(/40 minutes, longer than the 30 minute limit/);
    expect(postValidate([mcq(1)], { ...base, count: 1 }).warnings).toEqual([]);
  });
  it('filters types that were not requested', () => {
    const r = postValidate([mcq(1), short(1)], { ...base, count: 2, types: ['mcq'] });
    expect(r.questions).toHaveLength(1);
  });
});

describe('balanceTypes and leastCoveredFirst', () => {
  it('keeps at most the wanted number of each type and reports what is missing', () => {
    const qs = [...Array.from({ length: 8 }, (_, i) => mcq(i)), short(1), short(2)];
    const { kept, need } = balanceTypes(qs, { mcq: 7, short: 3 });
    expect(kept.filter((q) => q.type === 'mcq')).toHaveLength(7);
    expect(kept.filter((q) => q.type === 'short')).toHaveLength(2);
    expect(need).toEqual({ mcq: 0, short: 1 });
  });
  it('needs nothing when the split is right, and everything of a type that is absent', () => {
    expect(balanceTypes([mcq(1), short(1)], { mcq: 1, short: 1 }).need).toEqual({ mcq: 0, short: 0 });
    expect(balanceTypes([mcq(1)], { mcq: 1, short: 2 }).need).toEqual({ mcq: 0, short: 2 });
  });
  it('orders skills from least to most covered', () => {
    const qs = [mcq(1, 'React'), mcq(2, 'React'), mcq(3, 'SQL')];
    expect(leastCoveredFirst(qs, SKILLS)).toEqual(['APIs', 'Debugging', 'SQL', 'React']);
  });
});
