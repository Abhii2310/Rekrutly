import { describe, expect, it } from 'vitest';
import { mcqSummary, minutesTaken, parseCompareIds, strongestEvidence, truncate } from '@/lib/analytics/compare';
import type { DetailQuestion } from '@/lib/db/queries/submission';

const A = '11111111-1111-4111-8111-111111111111';
const B = '22222222-2222-4222-8222-222222222222';
const C = '33333333-3333-4333-8333-333333333333';
const D = '44444444-4444-4444-8444-444444444444';
const E = '55555555-5555-4555-8555-555555555555';

describe('parseCompareIds', () => {
  it('accepts two to four distinct ids and keeps the order given', () => {
    expect(parseCompareIds(`${B},${A}`)).toEqual({ ok: true, data: [B, A] });
    expect(parseCompareIds(` ${A} , ${B},${C},${D}`)).toMatchObject({ ok: true });
    expect(parseCompareIds(`${A},${A},${B}`)).toEqual({ ok: true, data: [A, B] });
  });
  it('explains what is wrong in plain words', () => {
    expect(parseCompareIds(undefined)).toMatchObject({ ok: false, error: { code: 'no_selection' } });
    expect(parseCompareIds(A)).toMatchObject({ ok: false, error: { code: 'too_few' } });
    expect(parseCompareIds(`${A},${A}`)).toMatchObject({ ok: false, error: { code: 'too_few' } });
    expect(parseCompareIds(`${A},${B},${C},${D},${E}`)).toMatchObject({ ok: false, error: { code: 'too_many' } });
    expect(parseCompareIds(`${A},nope`)).toMatchObject({ ok: false, error: { code: 'invalid_selection' } });
  });
});

function q(over: Partial<DetailQuestion> & { id: string }): DetailQuestion {
  return {
    position: 0, type: 'short', prompt: 'Explain an index.\nSecond line.', options: null, skill: 'SQL', difficulty: 'easy', max_score: 6, key: null, answer: null,
    score: { id: 's', method: 'ai_suggested', score: 4, max_score: 6, is_correct: null, unanswered: false, reasoning: null, evidence_quote: 'an index speeds lookups', matched_criteria: null, missing_criteria: null, confidence: 'high', overridden_score: null, override_reason: null },
    ...over,
  };
}

describe('strongestEvidence', () => {
  it('picks the written answer with the highest share of points, using overrides', () => {
    const qs = [
      q({ id: 'a', position: 0 }),
      q({ id: 'b', position: 1, score: { ...(q({ id: 'x' }).score as NonNullable<DetailQuestion['score']>), score: 3, evidence_quote: 'second quote' } }),
      q({ id: 'c', position: 2, score: { ...(q({ id: 'x' }).score as NonNullable<DetailQuestion['score']>), score: 1, overridden_score: 6, evidence_quote: 'overridden quote' } }),
    ];
    expect(strongestEvidence(qs, 'SQL')).toEqual({ quote: 'overridden quote', question: 'Explain an index.', score: 6, max: 6 });
  });
  it('is null only when the skill has no written answer, and never hides an answer that has no quote', () => {
    const base = q({ id: 'x' }).score as NonNullable<DetailQuestion['score']>;
    expect(strongestEvidence([q({ id: 'a', type: 'mcq' })], 'SQL')).toBeNull();
    expect(strongestEvidence([q({ id: 'a', score: { ...base, unanswered: true } })], 'SQL')).toBeNull();
    expect(strongestEvidence([q({ id: 'a' })], 'React')).toBeNull();
    expect(strongestEvidence([q({ id: 'a', score: { ...base, score: 6, evidence_quote: '  ' } })], 'SQL')).toEqual({ quote: null, question: 'Explain an index.', score: 6, max: 6 });
  });
  it('prefers an answer with a quote over a better one without', () => {
    const base = q({ id: 'x' }).score as NonNullable<DetailQuestion['score']>;
    const got = strongestEvidence([q({ id: 'a', position: 0, score: { ...base, score: 6, evidence_quote: null } }), q({ id: 'b', position: 1, score: { ...base, score: 2, evidence_quote: 'quoted words' } })], 'SQL');
    expect(got?.quote).toBe('quoted words');
  });
});

describe('mcqSummary, minutesTaken, truncate', () => {
  it('counts correct multiple-choice answers for a skill', () => {
    const sc = (ok: boolean) => ({ ...(q({ id: 'x' }).score as NonNullable<DetailQuestion['score']>), is_correct: ok });
    expect(mcqSummary([q({ id: '1', type: 'mcq', score: sc(true) }), q({ id: '2', type: 'mcq', score: sc(false) }), q({ id: '3', type: 'short' })], 'SQL')).toEqual({ correct: 1, total: 2 });
    expect(mcqSummary([q({ id: '3', type: 'short' })], 'SQL')).toBeNull();
  });
  it('measures time taken from start to submit', () => {
    expect(minutesTaken('2026-10-21T10:00:00Z', '2026-10-21T10:17:30Z')).toBe(17.5);
    expect(minutesTaken(null, '2026-10-21T10:17:30Z')).toBeNull();
    expect(minutesTaken('2026-10-21T11:00:00Z', '2026-10-21T10:00:00Z')).toBeNull();
  });
  it('cuts long quotes at a word', () => {
    expect(truncate('short', 10)).toBe('short');
    expect(truncate('one two three four five', 12)).toBe('one two…');
  });
});
