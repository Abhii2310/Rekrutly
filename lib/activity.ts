/** Filters for the Activity page. Pure data, shared by the page, the CSV export and the tests. */
export const ACTIVITY_GROUPS = [
  { key: 'all', label: 'All', prefixes: [] as string[] },
  { key: 'agent', label: 'Plans and steps', prefixes: ['plan.', 'step.', 'run.', 'approval.', 'question.', 'questions.', 'assessment.'] },
  { key: 'candidates', label: 'Candidates', prefixes: ['candidate.', 'invitation.', 'email.'] },
  { key: 'scoring', label: 'Scoring', prefixes: ['score.', 'report.'] },
  { key: 'followups', label: 'Follow-ups', prefixes: ['followup.', 'task.'] },
  { key: 'safety', label: 'Safety', prefixes: ['guardrail.', 'plan.fallback_used', 'questions.fallback_used', 'candidate.deleted', 'candidate.exported'] },
  { key: 'admin', label: 'Admin', prefixes: ['job.', 'candidate.imported', 'candidate.deleted', 'candidate.exported', 'demo.', 'system.'] },
] as const;

export type ActivityGroup = (typeof ACTIVITY_GROUPS)[number]['key'];

export function parseGroup(value: string | undefined): ActivityGroup {
  return ACTIVITY_GROUPS.find((g) => g.key === value)?.key ?? 'all';
}

/** The PostgREST `or` filter for a group, or null for "All". A prefix ending in "." matches every type that starts with it. */
export function groupFilter(group: ActivityGroup): string | null {
  const g = ACTIVITY_GROUPS.find((x) => x.key === group);
  if (!g || g.prefixes.length === 0) return null;
  return g.prefixes.map((p) => (p.endsWith('.') ? `type.like.${p}*` : `type.eq.${p}`)).join(',');
}
