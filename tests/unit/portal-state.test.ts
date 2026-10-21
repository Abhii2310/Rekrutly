import { describe, expect, it } from 'vitest';
import { GRACE_SECONDS, canWriteAnswers, getPortalState, isWithinDeadline, validateAnswer, type InvitationTiming } from '@/lib/portal/state';

const T = (iso: string) => new Date(iso);
const base: InvitationTiming = {
  status: 'sent', expires_at: '2026-11-10T10:00:00Z', started_at: null, deadline_at: null, submitted_at: null,
};
const started: InvitationTiming = { ...base, status: 'started', started_at: '2026-11-03T10:00:00Z', deadline_at: '2026-11-03T10:30:00Z' };

describe('getPortalState', () => {
  it('is ready before the link expires and expired after', () => {
    expect(getPortalState(base, T('2026-11-05T10:00:00Z'))).toBe('ready');
    expect(getPortalState(base, T('2026-11-10T10:00:01Z'))).toBe('expired');
    expect(getPortalState({ ...base, status: 'expired' }, T('2026-11-05T10:00:00Z'))).toBe('expired');
  });
  it('is revoked whatever else is true', () => {
    expect(getPortalState({ ...started, status: 'revoked' }, T('2026-11-03T10:10:00Z'))).toBe('revoked');
    expect(getPortalState({ ...base, status: 'revoked' }, T('2026-11-05T10:00:00Z'))).toBe('revoked');
  });
  it('is in progress until the deadline, then time up', () => {
    expect(getPortalState(started, T('2026-11-03T10:29:59Z'))).toBe('in_progress');
    expect(getPortalState(started, T('2026-11-03T10:30:00Z'))).toBe('in_progress');
    expect(getPortalState(started, T('2026-11-03T10:30:01Z'))).toBe('time_up');
  });
  it('a started test never goes back to expired, even after the link expiry date', () => {
    expect(getPortalState(started, T('2026-11-20T10:00:00Z'))).toBe('time_up');
    expect(getPortalState({ ...started, expires_at: '2026-11-03T10:05:00Z' }, T('2026-11-03T10:10:00Z'))).toBe('in_progress');
  });
  it('is submitted once submitted, even if the clock is past the deadline', () => {
    const done = { ...started, status: 'submitted', submitted_at: '2026-11-03T10:20:00Z' };
    expect(getPortalState(done, T('2026-11-03T12:00:00Z'))).toBe('submitted');
    expect(getPortalState({ ...started, status: 'submitted' }, T('2026-11-03T10:10:00Z'))).toBe('submitted');
  });
});

describe('isWithinDeadline', () => {
  it('allows the deadline plus 30 seconds of grace, not a second more', () => {
    expect(GRACE_SECONDS).toBe(30);
    expect(isWithinDeadline(started, T('2026-11-03T10:30:00Z'))).toBe(true);
    expect(isWithinDeadline(started, T('2026-11-03T10:30:30Z'))).toBe(true);
    expect(isWithinDeadline(started, T('2026-11-03T10:30:31Z'))).toBe(false);
  });
  it('is false when there is no deadline yet, and respects a custom grace', () => {
    expect(isWithinDeadline({ deadline_at: null }, T('2026-11-03T10:00:00Z'))).toBe(false);
    expect(isWithinDeadline(started, T('2026-11-03T10:31:00Z'), 120)).toBe(true);
  });
});

describe('canWriteAnswers', () => {
  it('accepts writes in progress and in the grace window, rejects after, before start and after submit', () => {
    expect(canWriteAnswers(started, T('2026-11-03T10:10:00Z'))).toBe(true);
    expect(canWriteAnswers(started, T('2026-11-03T10:30:20Z'))).toBe(true);
    expect(canWriteAnswers(started, T('2026-11-03T10:31:00Z'))).toBe(false);
    expect(canWriteAnswers(base, T('2026-11-05T10:00:00Z'))).toBe(false);
    expect(canWriteAnswers({ ...started, submitted_at: '2026-11-03T10:20:00Z' }, T('2026-11-03T10:21:00Z'))).toBe(false);
  });
});

describe('validateAnswer', () => {
  const mcq = { type: 'mcq' as const, options: ['a', 'b', 'c', 'd'] };
  const short = { type: 'short' as const, options: null };

  it('accepts a valid option and clears an unselected one', () => {
    expect(validateAnswer(mcq, { selectedOption: 2 })).toEqual({ ok: true, data: { selected_option: 2, text_answer: null } });
    expect(validateAnswer(mcq, { selectedOption: null })).toEqual({ ok: true, data: { selected_option: null, text_answer: null } });
  });
  it('rejects an option outside the question, negative, or not a whole number', () => {
    for (const n of [4, -1, 1.5, Number.NaN]) expect(validateAnswer(mcq, { selectedOption: n }).ok).toBe(false);
  });
  it('ignores text sent for a multiple-choice question', () => {
    expect(validateAnswer(mcq, { selectedOption: 1, textAnswer: 'sneaky' })).toEqual({ ok: true, data: { selected_option: 1, text_answer: null } });
  });
  it('accepts text up to 5000 characters and rejects more', () => {
    expect(validateAnswer(short, { textAnswer: 'x'.repeat(5000) }).ok).toBe(true);
    const long = validateAnswer(short, { textAnswer: 'x'.repeat(5001) });
    expect(!long.ok && long.error.code).toBe('answer_too_long');
  });
  it('turns an empty written answer into null and rejects an option on a written question', () => {
    expect(validateAnswer(short, { textAnswer: '' })).toEqual({ ok: true, data: { selected_option: null, text_answer: null } });
    expect(validateAnswer(short, { selectedOption: 0 }).ok).toBe(false);
  });
});
