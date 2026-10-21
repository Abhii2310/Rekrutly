import type { DeliveryStatus, InvitationStatus, ReportStatus, ScoringStatus, Stage } from '@/lib/status';

/** One candidate in a run, with everything the task and next-action rules look at. Plain data, no I/O. */
export type PipelineInvitation = {
  id: string;
  candidateId: string;
  name: string;
  email: string | null;
  phone: string | null;
  stage: Stage;
  status: InvitationStatus;
  deliveryStatus: DeliveryStatus;
  createdAt: string;
  currentQuestion: number | null;
  deadlineAt: string | null;
  submittedAt: string | null;
  lastActivityAt: string | null;
  submissionId: string | null;
  scoringStatus: ScoringStatus | null;
  reportStatus: ReportStatus | null;
};

export const INVITATION_SELECT =
  'id, candidate_id, status, delivery_status, current_question, deadline_at, submitted_at, last_activity_at, created_at, candidates(full_name, email, phone, stage), submissions(id, scoring_status, report_status)';

type Raw = {
  id: string; candidate_id: string; status: InvitationStatus; delivery_status: DeliveryStatus;
  current_question: number | null; deadline_at: string | null; submitted_at: string | null; last_activity_at: string | null; created_at: string;
  candidates: { full_name: string; email: string | null; phone: string | null; stage: Stage } | null;
  // One-to-one, but PostgREST may return an object or a one-item array.
  submissions: { id: string; scoring_status: ScoringStatus; report_status: ReportStatus } | { id: string; scoring_status: ScoringStatus; report_status: ReportStatus }[] | null;
};

export function toPipelineInvitation(row: unknown): PipelineInvitation {
  const r = row as Raw;
  const sub = Array.isArray(r.submissions) ? (r.submissions[0] ?? null) : r.submissions;
  return {
    id: r.id, candidateId: r.candidate_id,
    name: r.candidates?.full_name ?? 'Candidate', email: r.candidates?.email ?? null, phone: r.candidates?.phone ?? null,
    stage: r.candidates?.stage ?? 'applied', status: r.status, deliveryStatus: r.delivery_status, createdAt: r.created_at,
    currentQuestion: r.current_question, deadlineAt: r.deadline_at, submittedAt: r.submitted_at, lastActivityAt: r.last_activity_at,
    submissionId: sub?.id ?? null, scoringStatus: sub?.scoring_status ?? null, reportStatus: sub?.report_status ?? null,
  };
}

export const NOT_STARTED: readonly InvitationStatus[] = ['created', 'sent', 'opened'];
export const firstName = (full: string): string => full.trim().split(/\s+/)[0] ?? full;
