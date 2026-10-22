import { describe, expect, it } from 'vitest';
import { DAILY_LIMIT, HOURLY_LIMIT, overBudget } from '@/lib/executor/email-limits';

describe('email budget', () => {
  it('allows normal use', () => {
    expect(overBudget(5, 20)).toBe(false);
    expect(overBudget(HOURLY_LIMIT - 1, DAILY_LIMIT - 1)).toBe(false);
  });
  it('stops at either limit', () => {
    expect(overBudget(HOURLY_LIMIT, 10)).toBe(true);
    expect(overBudget(1, DAILY_LIMIT)).toBe(true);
  });
});
