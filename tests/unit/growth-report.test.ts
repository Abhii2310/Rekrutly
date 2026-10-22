import { describe, expect, it } from 'vitest';
import { growthReport, reportLine } from '@/lib/growth/report';

describe('growthReport', () => {
  const r = growthReport(64, [
    { skill: 'React', percent: 90 }, { skill: 'SQL', percent: 40 }, { skill: 'APIs', percent: 65 }, { skill: 'Debugging', percent: 20 },
  ]);
  it('lists strengths strongest first', () => expect(r.strong.map((s) => s.skill)).toEqual(['React']));
  it('lists the weakest skills first to practise, never more than three', () => {
    expect(r.growing.map((s) => s.skill)).toEqual(['Debugging', 'SQL']);
    expect(r.steps).toHaveLength(2);
    expect(r.steps[0]?.tip).toContain('Debugging');
  });
  it('clamps and drops bad numbers', () => {
    const x = growthReport(null, [{ skill: 'A', percent: 140 }, { skill: 'B', percent: Number.NaN }]);
    expect(x.all).toEqual([{ skill: 'A', percent: 100 }]);
  });
  it('adds a private-link line', () => expect(reportLine('https://x/a/t/growth')).toContain('https://x/a/t/growth'));
});

import { attemptCostUsd } from '@/lib/growth/savings';
describe('attemptCostUsd', () => {
  it('multiplies tests by the per-attempt price', () => expect(attemptCostUsd(12)).toBe(240));
  it('never goes negative', () => expect(attemptCostUsd(-3)).toBe(0));
});
