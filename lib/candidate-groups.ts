import type { Stage } from '@/lib/status';

export const STAGE_GROUPS = [
  { value: 'all', label: 'All', stages: undefined },
  { value: 'new', label: 'New', stages: ['applied'] },
  { value: 'assessment', label: 'In assessment', stages: ['assessment_invited', 'assessment_in_progress'] },
  { value: 'review', label: 'Review', stages: ['assessment_submitted', 'under_review'] },
  { value: 'later', label: 'Interview and later', stages: ['interview', 'offer', 'hired', 'rejected', 'withdrawn'] },
] as const satisfies readonly { value: string; label: string; stages: readonly Stage[] | undefined }[];

export type StageGroup = (typeof STAGE_GROUPS)[number]['value'];

export function parseGroup(value: string | undefined): StageGroup {
  return STAGE_GROUPS.find((g) => g.value === value)?.value ?? 'all';
}

export function groupStages(group: StageGroup): Stage[] | undefined {
  const g = STAGE_GROUPS.find((x) => x.value === group);
  return g?.stages ? [...g.stages] : undefined;
}
