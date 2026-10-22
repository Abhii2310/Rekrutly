/** Published extra-attempt price on a typical per-candidate assessment plan, in US dollars. Check the vendor's page before quoting it. */
export const PER_ATTEMPT_USD = 20;

/** What the same number of candidate tests would cost at a per-attempt price. An estimate, never a quote. */
export function attemptCostUsd(testsTaken: number, perAttempt: number = PER_ATTEMPT_USD): number {
  return Math.max(0, Math.round(testsTaken)) * perAttempt;
}
