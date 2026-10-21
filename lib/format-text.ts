import { statusLabel, type Stage } from '@/lib/status';

export function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}

/** "5 new" or "2 new, 2 interview, 1 offer". Lists the stages that have candidates, in pipeline order. */
export function stageSummary(counts: Partial<Record<Stage, number>>, order: readonly Stage[]): string {
  const parts = order
    .filter((s) => (counts[s] ?? 0) > 0)
    .map((s) => `${counts[s]} ${statusLabel('candidate', s).toLowerCase()}`);
  return parts.length ? parts.join(', ') : 'No candidates';
}
