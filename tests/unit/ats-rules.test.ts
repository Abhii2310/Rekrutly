import { describe, expect, it } from 'vitest';
import { matchScore, mentions, redactResume, skillCoverage, verifiedQuotes } from '@/lib/ats/rules';

const resume = 'Built React and TypeScript dashboards with a Node.js API on Postgres. Wrote REST endpoints and fixed production bugs.';

describe('resume rules', () => {
  it('finds skills by their usual names, as whole words', () => {
    expect(mentions(resume, 'React')).toBe(true);
    expect(mentions(resume, 'PostgreSQL')).toBe(true);
    expect(mentions(resume, 'Node.js')).toBe(true);
    expect(mentions('I work on reactive systems', 'React')).toBe(false);
    expect(mentions('I know javascript', 'Java')).toBe(false);
  });
  it('lists matched and missing skills and the ratio', () => {
    const c = skillCoverage(resume, ['React', 'TypeScript', 'Go', 'SQL']);
    expect(c.matched).toEqual(['React', 'TypeScript', 'SQL']);
    expect(c.missing).toEqual(['Go']);
    expect(c.ratio).toBeCloseTo(0.75);
  });
  it('scores 70% skills and 30% relevance, or skills only without the AI part', () => {
    const c = { matched: ['a', 'b'], missing: ['c', 'd'], ratio: 0.5 };
    expect(matchScore(c, null)).toBe(50);
    expect(matchScore(c, 1)).toBe(65);
    expect(matchScore(c, 0)).toBe(35);
    expect(matchScore({ matched: [], missing: [], ratio: 0 }, 0.5)).toBe(15);
  });
  it('keeps only quotes that are really in the resume', () => {
    const kept = verifiedQuotes(resume, [{ quote: 'Node.js API on Postgres' }, { quote: 'Led a team of fifty engineers' }, { quote: 'short' }]);
    expect(kept).toEqual([{ quote: 'Node.js API on Postgres' }]);
  });
  it('removes emails, links and phone numbers before the model sees the text', () => {
    const out = redactResume('Asha asha@mail.com +91 98765 43210 https://github.com/asha React');
    expect(out).not.toMatch(/asha@mail|98765|github/);
    expect(out).toContain('React');
  });
});
