import type { TaskType } from '@/lib/status';
import { firstName, NOT_STARTED, type PipelineInvitation } from './pipeline';

export type TaskSpec = { dedupeKey: string; type: TaskType; candidateId: string; title: string; detail: string };

export type RuleInput = {
  now: Date;
  overdueMinutes: number;
  invitations: PipelineInvitation[];
  /** Candidates of the run's job who were moved to the interview stage. */
  interviewCandidates: { id: string; name: string }[];
};

/** Task types that rules create and close on their own. Anything else (custom tasks) is left alone. */
export const MANAGED_PREFIXES = ['follow_up:', 'missing_email:', 'review_submission:', 'schedule_interview:'] as const;
export const isManagedKey = (key: string | null): key is string => key !== null && MANAGED_PREFIXES.some((p) => key.startsWith(p));

/**
 * Pure. The four rules from ARCHITECTURE section 11. Returns the tasks that should be open right now;
 * the caller upserts these and closes managed tasks that are no longer in the list.
 */
export function selectTasks(input: RuleInput): TaskSpec[] {
  const wanted: TaskSpec[] = [];
  const overdueMs = input.overdueMinutes * 60_000;

  for (const inv of input.invitations) {
    const who = firstName(inv.name);
    if (NOT_STARTED.includes(inv.status) && input.now.getTime() - new Date(inv.createdAt).getTime() >= overdueMs) {
      wanted.push({
        dedupeKey: `follow_up:${inv.id}`, type: 'follow_up', candidateId: inv.candidateId,
        title: `Nudge ${who} to start`,
        detail: inv.status === 'opened' ? 'Opened the link but has not started the test.' : 'Has not opened the link yet.',
      });
    }
    if (!inv.email && inv.status !== 'submitted' && inv.status !== 'revoked') {
      wanted.push({
        dedupeKey: `missing_email:${inv.candidateId}`, type: 'missing_email', candidateId: inv.candidateId,
        title: `Add an email for ${who}`, detail: 'No email on file. Share the link on WhatsApp, or add an email address.',
      });
    }
    if (inv.submissionId && inv.scoringStatus === 'scored' && inv.stage === 'assessment_submitted') {
      wanted.push({
        dedupeKey: `review_submission:${inv.submissionId}`, type: 'review_submission', candidateId: inv.candidateId,
        title: `Review ${who}'s submission`, detail: 'Scored and ready to review.',
      });
    }
  }
  for (const c of input.interviewCandidates) {
    wanted.push({
      dedupeKey: `schedule_interview:${c.id}`, type: 'schedule_interview', candidateId: c.id,
      title: `Schedule an interview with ${firstName(c.name)}`, detail: 'Moved to the interview stage.',
    });
  }
  return wanted;
}

/** Open managed tasks whose condition is gone. These are closed with "Resolved automatically". */
export function keysToResolve(openKeys: (string | null)[], wanted: TaskSpec[]): string[] {
  const keep = new Set(wanted.map((w) => w.dedupeKey));
  return openKeys.filter(isManagedKey).filter((k) => !keep.has(k));
}

/** Wanted tasks that do not exist yet (open, done or dismissed). A task a person finished is never recreated. */
export function keysToCreate(existingKeys: (string | null)[], wanted: TaskSpec[]): TaskSpec[] {
  const have = new Set(existingKeys.filter((k): k is string => k !== null));
  return wanted.filter((w) => !have.has(w.dedupeKey));
}
