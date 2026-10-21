import { describe, expect, it } from 'vitest';
import { formatDateTime, formatPercent, formatRelative, formatTime } from '@/lib/format';

const now = new Date('2026-11-03T10:00:00Z');
const ago = (ms: number) => new Date(now.getTime() - ms);
const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

describe('formatRelative', () => {
  it('says just now under 45 seconds, including slightly in the future', () => {
    expect(formatRelative(ago(5_000), now)).toBe('just now');
    expect(formatRelative(ago(-10_000), now)).toBe('just now');
  });
  it('uses minutes, hours and days', () => {
    expect(formatRelative(ago(5 * MIN), now)).toBe('5 min ago');
    expect(formatRelative(ago(59 * MIN), now)).toBe('59 min ago');
    expect(formatRelative(ago(HOUR), now)).toBe('1 hour ago');
    expect(formatRelative(ago(3 * HOUR), now)).toBe('3 hours ago');
    expect(formatRelative(ago(DAY), now)).toBe('yesterday');
    expect(formatRelative(ago(3 * DAY), now)).toBe('3 days ago');
  });
  it('falls back to a date after a week', () => {
    expect(formatRelative(ago(10 * DAY), now)).toBe('24 Oct 2026');
  });
  it('accepts ISO strings', () => {
    expect(formatRelative('2026-11-03T09:55:00Z', now)).toBe('5 min ago');
  });
});

describe('formatDateTime', () => {
  it('formats in en-IN and India time', () => {
    expect(formatDateTime('2026-11-03T10:12:00Z')).toBe('3 Nov, 3:42 pm');
  });
});

describe('formatTime', () => {
  it('formats the time of day in India time', () => {
    expect(formatTime('2026-11-03T10:12:00Z')).toBe('3:42 pm');
  });
});

describe('formatPercent', () => {
  it('rounds a ratio to a whole percent', () => {
    expect(formatPercent(0.6849)).toBe('68%');
    expect(formatPercent(1)).toBe('100%');
    expect(formatPercent(0)).toBe('0%');
  });
  it('shows an en dash when there is no value', () => {
    expect(formatPercent(null)).toBe('–');
    expect(formatPercent(undefined)).toBe('–');
    expect(formatPercent(Number.NaN)).toBe('–');
  });
});
