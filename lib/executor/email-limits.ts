export const HOURLY_LIMIT = 60;
export const DAILY_LIMIT = 250;

/** Pure. True when sending one more email would pass either limit. */
export const overBudget = (lastHour: number, lastDay: number): boolean => lastHour >= HOURLY_LIMIT || lastDay >= DAILY_LIMIT;
