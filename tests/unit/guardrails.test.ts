import { describe, expect, it } from 'vitest';
import { checkInstruction, redactFlagged } from '@/lib/guardrails/protected';

const phrases = (t: string) => checkInstruction(t).flagged.map((f) => f.phrase.toLowerCase());

describe('guardrail: flags', () => {
  it('flags an age filter', () => {
    expect(phrases('only invite candidates under 30')).toEqual(['under 30']);
  });
  it('flags gender', () => {
    expect(phrases('only women')).toEqual(['women']);
    expect(phrases('invite male candidates')).toEqual(['male']);
  });
  it('flags age phrases with units of age', () => {
    expect(phrases('candidates under 30 years')).toContain('under 30');
    expect(phrases('nobody below 25')).toEqual(['below 25']);
    expect(phrases('older than 40 is a no')).toEqual(['older than 40']);
    expect(phrases('prefer a 28 year old')).toContain('28 year old');
    expect(phrases('young and energetic')).toEqual(['young']);
  });
  it('flags religion, caste, marital status, pregnancy, disability, nationality', () => {
    for (const t of ['no hindu candidates', 'skip dalit applicants', 'unmarried only', 'avoid pregnant candidates', 'not disabled people', 'by nationality']) {
      expect(checkInstruction(t).flagged.length, t).toBeGreaterThan(0);
    }
  });
  it('is case-insensitive and de-duplicates', () => {
    expect(phrases('WOMEN and women and Women')).toEqual(['women']);
  });
  it('gives a plain-English reason', () => {
    expect(checkInstruction('only women').flagged[0]?.reason).toMatch(/doesn't filter candidates by gender/);
  });
});

describe('guardrail: does not flag normal instructions', () => {
  it.each([
    '30-minute assessment',
    'under 30 minutes',
    'below 20 questions',
    '5 candidates',
    'more than 10 questions please',
    'candidates with more than 5 years of experience',
    'over 40 candidates in the pipeline',
    'manage the pipeline and message the team',
    'Prepare a 30-minute full-stack developer assessment for the five candidates in this job. Cover React, APIs, SQL and debugging. Show me the questions before inviting anyone.',
    'Prepare the next hiring steps, identify blockers and draft outstanding follow-ups. Ask me before sending anything.',
    'mentor and review code',
  ])('%s', (t) => {
    expect(checkInstruction(t).flagged).toEqual([]);
  });
});

describe('redactFlagged', () => {
  it('removes the flagged phrase before the model sees it', () => {
    const text = 'Create an assessment but only invite candidates under 30';
    expect(redactFlagged(text, checkInstruction(text).flagged)).toBe('Create an assessment but only invite candidates [removed]');
  });
});
