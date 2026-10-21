import { describe, expect, it } from 'vitest';
import { groupStages, parseGroup } from '@/lib/candidate-groups';
import { plural, stageSummary } from '@/lib/format-text';
import { CANDIDATE_STAGES } from '@/lib/status';

describe('stage groups', () => {
  it('falls back to all for unknown values', () => {
    expect(parseGroup(undefined)).toBe('all');
    expect(parseGroup('nonsense')).toBe('all');
    expect(parseGroup('review')).toBe('review');
  });
  it('maps groups to stages, with all meaning no filter', () => {
    expect(groupStages('all')).toBeUndefined();
    expect(groupStages('new')).toEqual(['applied']);
    expect(groupStages('assessment')).toEqual(['assessment_invited', 'assessment_in_progress']);
  });
  it('covers every stage exactly once across the non-all groups', () => {
    const all = (['new', 'assessment', 'review', 'later'] as const).flatMap((g) => groupStages(g) ?? []);
    expect([...all].sort()).toEqual([...CANDIDATE_STAGES].sort());
  });
});

describe('text helpers', () => {
  it('pluralizes', () => {
    expect(plural(1, 'candidate')).toBe('1 candidate');
    expect(plural(0, 'candidate')).toBe('0 candidates');
    expect(plural(3, 'open role')).toBe('3 open roles');
  });
  it('summarises stages in pipeline order and skips empty ones', () => {
    expect(stageSummary({ interview: 2, applied: 2, offer: 1 }, CANDIDATE_STAGES)).toBe('2 new, 2 interview, 1 offer');
    expect(stageSummary({}, CANDIDATE_STAGES)).toBe('No candidates');
  });
});
