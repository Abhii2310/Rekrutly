import { describe, expect, it } from 'vitest';
import { chooseOption, seededRandom, skillStrength, strengthLabel, templatedAnswer } from '@/lib/demo/strength';

describe('seededRandom', () => {
  it('gives the same sequence for the same seed and a different one for another seed', () => {
    const a = seededRandom('aarav:1'); const b = seededRandom('aarav:1'); const c = seededRandom('diya:1');
    const first = [a(), a(), a()];
    expect([b(), b(), b()]).toEqual(first);
    expect([c(), c(), c()]).not.toEqual(first);
    for (const n of first) { expect(n).toBeGreaterThanOrEqual(0); expect(n).toBeLessThan(1); }
  });
});

describe('skillStrength', () => {
  const rand = () => 0.5; // no jitter
  it('is strong in skills on the profile, middling in related ones and weaker elsewhere', () => {
    const aarav = ['React', 'TypeScript', 'Next.js', 'REST APIs'];
    expect(skillStrength(aarav, 'React', rand)).toBeGreaterThan(0.8);
    expect(skillStrength(aarav, 'APIs', rand)).toBeGreaterThan(0.6);
    expect(skillStrength(aarav, 'SQL', rand)).toBeLessThan(0.5);
    expect(skillStrength(aarav, 'debugging', rand)).toBeLessThan(0.5);
    const diya = ['Node.js', 'PostgreSQL', 'API design', 'Redis'];
    expect(skillStrength(diya, 'SQL', rand)).toBeGreaterThan(0.6);
    expect(skillStrength(diya, 'React', rand)).toBeLessThan(0.5);
  });
  it('stays inside 0.08 to 0.97 whatever the jitter', () => {
    for (const r of [0, 0.999]) {
      const s = skillStrength(['React'], 'React', () => r);
      expect(s).toBeGreaterThanOrEqual(0.08); expect(s).toBeLessThanOrEqual(0.97);
    }
  });
});

describe('chooseOption', () => {
  it('is deterministic for a seed', () => {
    const run = () => { const r = seededRandom('x'); return Array.from({ length: 12 }, () => chooseOption(0.6, 2, 4, r)); };
    expect(run()).toEqual(run());
  });
  it('picks the correct option about as often as the strength says, and never an invalid one', () => {
    const r = seededRandom('stats');
    const picks = Array.from({ length: 2000 }, () => chooseOption(0.8, 1, 4, r));
    const correct = picks.filter((p) => p === 1).length / picks.length;
    expect(correct).toBeGreaterThan(0.75); expect(correct).toBeLessThan(0.86);
    expect(picks.every((p) => p >= 0 && p <= 3)).toBe(true);
    const strong = Array.from({ length: 200 }, () => chooseOption(1, 3, 4, r));
    expect(strong.every((p) => p === 3)).toBe(true);
    const weak = Array.from({ length: 200 }, () => chooseOption(0, 3, 4, r));
    expect(weak.every((p) => p !== 3)).toBe(true);
  });
});

describe('templated answers', () => {
  it('match the strength level', () => {
    expect(strengthLabel(0.9)).toBe('strong'); expect(strengthLabel(0.6)).toBe('mixed'); expect(strengthLabel(0.2)).toBe('weak');
    expect(templatedAnswer(0.9, 'SQL').length).toBeGreaterThan(templatedAnswer(0.2, 'SQL').length);
    expect(templatedAnswer(0.2, 'SQL')).toContain('SQL');
  });
});
