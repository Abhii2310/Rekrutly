import { describe, expect, it } from 'vitest';
import { describeChoice, describeSignals, resultState, splitAtQuote } from '@/lib/scoring/labels';

describe('resultState', () => {
  const sub = (scoring_status: string, report_status: string) => ({ scoring_status, report_status });
  const base = { invitationStatus: 'started', currentQuestion: null as number | null, questionCount: 10 };
  it('describes candidates who have not submitted', () => {
    expect(resultState({ ...base, invitationStatus: 'sent', submission: null }).label).toBe('Not started');
    expect(resultState({ ...base, currentQuestion: 4, submission: null }).label).toBe('Question 4 of 10');
    expect(resultState({ ...base, submission: null }).label).toBe('Started');
    expect(resultState({ ...base, invitationStatus: 'expired', submission: null }).label).toBe('Expired');
  });
  it('walks through submitted, scoring and ready', () => {
    expect(resultState({ ...base, submission: sub('pending', 'pending') }).label).toBe('Submitted');
    expect(resultState({ ...base, submission: sub('scoring', 'pending') }).label).toBe('Scoring…');
    expect(resultState({ ...base, submission: sub('scored', 'generating') }).label).toBe('Scoring…');
    expect(resultState({ ...base, submission: sub('scored', 'ready') })).toEqual({ label: 'Ready', tone: 'success' });
  });
  it('shows failures plainly', () => {
    expect(resultState({ ...base, submission: sub('failed', 'pending') }).label).toBe('Scoring failed');
    expect(resultState({ ...base, submission: sub('scored', 'failed') }).label).toBe('Report failed');
  });
});

describe('describeSignals', () => {
  it('words the counts', () => {
    expect(describeSignals({ tab_hidden: 2, paste: 1, window_blur: 0 })).toBe('switched tabs 2 times, pasted once');
    expect(describeSignals({ tab_hidden: 1, paste: 0, window_blur: 3 })).toBe('switched tabs once, left the window 3 times');
    expect(describeSignals({ tab_hidden: 0, paste: 0, window_blur: 0 })).toBe('no tab switches or pastes recorded');
  });
});

describe('describeChoice', () => {
  it('names the chosen and correct options', () => {
    expect(describeChoice(1, 1)).toBe('Chose B. Correct.');
    expect(describeChoice(0, 2)).toBe('Chose A. Correct answer: C.');
    expect(describeChoice(null, 3)).toBe('Not answered. Correct answer: D.');
    expect(describeChoice(null, null)).toBe('Not answered');
  });
});

describe('splitAtQuote', () => {
  it('splits around an exact quote and leaves the answer alone when there is none', () => {
    expect(splitAtQuote('I would index the column and check.', 'index the column')).toEqual({ before: 'I would ', match: 'index the column', after: ' and check.' });
    expect(splitAtQuote('abc', null)).toEqual({ before: 'abc', match: '', after: '' });
    expect(splitAtQuote('abc', 'xyz')).toEqual({ before: 'abc', match: '', after: '' });
  });
});
