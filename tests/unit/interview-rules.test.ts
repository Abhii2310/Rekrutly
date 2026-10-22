import { describe, expect, it } from 'vitest';
import { calendarLink, interviewText, joinState, whenLabel } from '@/lib/interviews/rules';

const start = new Date('2026-10-24T10:00:00Z'); // 3:30 pm IST

describe('interview rules', () => {
  it('opens ten minutes early and closes an hour after the slot ends', () => {
    expect(joinState(new Date('2026-10-24T09:49:00Z'), start, 30)).toBe('early');
    expect(joinState(new Date('2026-10-24T09:50:00Z'), start, 30)).toBe('open');
    expect(joinState(new Date('2026-10-24T11:30:00Z'), start, 30)).toBe('open');
    expect(joinState(new Date('2026-10-24T11:31:00Z'), start, 30)).toBe('ended');
  });
  it('writes the time in Indian time', () => {
    expect(whenLabel(start)).toBe('Saturday, 24 October 2026, 3:30 pm IST');
  });
  it('builds a calendar link with the right window', () => {
    const url = calendarLink({ title: 'Interview', start, durationMinutes: 30, details: 'Join: https://x' });
    expect(url).toContain('dates=20261024T100000Z%2F20261024T103000Z');
  });
  it('puts the join link and the time in the email', () => {
    const { subject, body } = interviewText({ firstName: 'Dev', role: 'Designer', start, durationMinutes: 30, joinUrl: 'https://rekrutly/i/abc', calendarUrl: 'https://cal' });
    expect(subject).toContain('Interview for the Designer role');
    expect(body).toContain('Join here: https://rekrutly/i/abc');
    expect(body).toContain('3:30 pm IST');
  });
});
