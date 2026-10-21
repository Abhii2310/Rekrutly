import { err, ok, type Result } from './result';

export type Tone = 'neutral' | 'action' | 'success' | 'warning' | 'danger' | 'ai';

type Def<V extends string> = {
  values: readonly V[];
  labels: Record<V, string>;
  tones: Record<V, Tone>;
  transitions: Record<V, readonly V[]>;
};

function def<const V extends string>(d: Def<V>): Def<V> {
  return d;
}

// ---- Allowed values (mirror the CHECK lists in supabase/migrations/0001_init.sql) ----
export const JOB_STATUSES = ['draft', 'open', 'paused', 'closed'] as const;
export const CANDIDATE_STAGES = [
  'applied', 'assessment_invited', 'assessment_in_progress', 'assessment_submitted',
  'under_review', 'interview', 'offer', 'hired', 'rejected', 'withdrawn',
] as const;
export const RUN_STATUSES = [
  'draft', 'awaiting_approval', 'approved', 'executing', 'waiting', 'paused', 'completed', 'failed', 'cancelled',
] as const;
export const STEP_STATUSES = [
  'planned', 'awaiting_approval', 'queued', 'executing', 'waiting', 'completed', 'failed', 'skipped', 'cancelled',
] as const;
export const ASSESSMENT_STATUSES = ['draft', 'approved', 'live', 'closed', 'archived'] as const;
export const INVITATION_STATUSES = ['created', 'sent', 'opened', 'started', 'submitted', 'expired', 'revoked'] as const;
export const DELIVERY_STATUSES = ['not_sent', 'sent', 'failed', 'unconfigured'] as const;
export const SCORING_STATUSES = ['pending', 'scoring', 'scored', 'failed'] as const;
export const REPORT_STATUSES = ['pending', 'generating', 'ready', 'failed'] as const;
export const TASK_STATUSES = ['open', 'done', 'dismissed'] as const;
export const TASK_TYPES = ['follow_up', 'review_submission', 'schedule_interview', 'missing_email', 'custom'] as const;

export type JobStatus = (typeof JOB_STATUSES)[number];
export type Stage = (typeof CANDIDATE_STAGES)[number];
export type RunStatus = (typeof RUN_STATUSES)[number];
export type StepStatus = (typeof STEP_STATUSES)[number];
export type AssessmentStatus = (typeof ASSESSMENT_STATUSES)[number];
export type InvitationStatus = (typeof INVITATION_STATUSES)[number];
export type DeliveryStatus = (typeof DELIVERY_STATUSES)[number];
export type ScoringStatus = (typeof SCORING_STATUSES)[number];
export type ReportStatus = (typeof REPORT_STATUSES)[number];
export type TaskStatus = (typeof TASK_STATUSES)[number];
export type TaskType = (typeof TASK_TYPES)[number];

const none = [] as const;
const ended = ['rejected', 'withdrawn'] as const;

const MAP = {
  job: def<JobStatus>({
    values: JOB_STATUSES,
    labels: { draft: 'Draft', open: 'Open', paused: 'Paused', closed: 'Closed' },
    tones: { draft: 'neutral', open: 'success', paused: 'warning', closed: 'neutral' },
    transitions: { draft: ['open', 'closed'], open: ['paused', 'closed'], paused: ['open', 'closed'], closed: ['open'] },
  }),
  candidate: def<Stage>({
    values: CANDIDATE_STAGES,
    labels: {
      applied: 'New', assessment_invited: 'Invited', assessment_in_progress: 'In assessment',
      assessment_submitted: 'Submitted', under_review: 'In review', interview: 'Interview',
      offer: 'Offer', hired: 'Hired', rejected: 'Rejected', withdrawn: 'Withdrawn',
    },
    tones: {
      applied: 'neutral', assessment_invited: 'action', assessment_in_progress: 'action',
      assessment_submitted: 'success', under_review: 'action', interview: 'action',
      offer: 'success', hired: 'success', rejected: 'neutral', withdrawn: 'neutral',
    },
    // The first four moves are made by Rekrutly as invitations progress; the rest are recruiter-only.
    transitions: {
      applied: ['assessment_invited', 'interview', ...ended],
      assessment_invited: ['assessment_in_progress', 'interview', ...ended],
      assessment_in_progress: ['assessment_submitted', ...ended],
      assessment_submitted: ['under_review', 'interview', ...ended],
      under_review: ['interview', ...ended],
      interview: ['offer', ...ended],
      offer: ['hired', ...ended],
      hired: none,
      rejected: none,
      withdrawn: none,
    },
  }),
  run: def<RunStatus>({
    values: RUN_STATUSES,
    labels: {
      draft: 'Draft', awaiting_approval: 'Waiting for you', approved: 'Approved', executing: 'Working',
      waiting: 'In progress', paused: 'Paused', completed: 'Done', failed: 'Needs attention', cancelled: 'Cancelled',
    },
    tones: {
      draft: 'neutral', awaiting_approval: 'warning', approved: 'action', executing: 'action', waiting: 'action',
      paused: 'warning', completed: 'success', failed: 'danger', cancelled: 'neutral',
    },
    transitions: {
      draft: ['awaiting_approval', 'approved', 'cancelled', 'failed'],
      awaiting_approval: ['approved', 'cancelled', 'failed'],
      approved: ['executing', 'failed'],
      executing: ['waiting', 'completed', 'paused', 'failed'],
      waiting: ['executing', 'completed', 'paused', 'failed'],
      paused: ['executing', 'waiting'],
      completed: none,
      failed: ['executing'], // retry of a failed step
      cancelled: none,
    },
  }),
  step: def<StepStatus>({
    values: STEP_STATUSES,
    labels: {
      planned: 'Planned', awaiting_approval: 'Waiting for you', queued: 'Queued', executing: 'Working',
      waiting: 'In progress', completed: 'Done', failed: 'Failed', skipped: 'Skipped', cancelled: 'Cancelled',
    },
    tones: {
      planned: 'neutral', awaiting_approval: 'warning', queued: 'neutral', executing: 'action',
      waiting: 'action', completed: 'success', failed: 'danger', skipped: 'neutral', cancelled: 'neutral',
    },
    transitions: {
      planned: ['awaiting_approval', 'queued', 'waiting', 'skipped', 'cancelled'], // waiting: steps driven by candidate activity
      awaiting_approval: ['queued', 'cancelled'],
      queued: ['executing', 'skipped', 'cancelled'],
      executing: ['completed', 'waiting', 'failed', 'skipped'],
      waiting: ['completed', 'failed', 'cancelled'],
      completed: none,
      failed: ['queued', 'executing'],
      skipped: none,
      cancelled: none,
    },
  }),
  assessment: def<AssessmentStatus>({
    values: ASSESSMENT_STATUSES,
    labels: { draft: 'Draft', approved: 'Approved', live: 'Live', closed: 'Closed', archived: 'Archived' },
    tones: { draft: 'neutral', approved: 'action', live: 'success', closed: 'neutral', archived: 'neutral' },
    transitions: { draft: ['approved'], approved: ['live'], live: ['closed'], closed: ['archived'], archived: none },
  }),
  invitation: def<InvitationStatus>({
    values: INVITATION_STATUSES,
    labels: {
      created: 'Link ready', sent: 'Sent', opened: 'Opened', started: 'In progress',
      submitted: 'Submitted', expired: 'Expired', revoked: 'Revoked',
    },
    tones: {
      created: 'neutral', sent: 'action', opened: 'action', started: 'action',
      submitted: 'success', expired: 'warning', revoked: 'neutral',
    },
    transitions: {
      created: ['sent', 'opened', 'expired', 'revoked'],
      sent: ['opened', 'expired', 'revoked'],
      opened: ['started', 'expired', 'revoked'],
      started: ['submitted', 'expired', 'revoked'],
      submitted: none,
      expired: none,
      revoked: none,
    },
  }),
  delivery: def<DeliveryStatus>({
    values: DELIVERY_STATUSES,
    labels: { not_sent: 'Not sent', sent: 'Email sent', failed: 'Email failed', unconfigured: 'Email not configured' },
    tones: { not_sent: 'neutral', sent: 'success', failed: 'danger', unconfigured: 'neutral' },
    transitions: { not_sent: ['sent', 'failed', 'unconfigured'], sent: none, failed: ['sent', 'failed'], unconfigured: none },
  }),
  scoring: def<ScoringStatus>({
    values: SCORING_STATUSES,
    labels: { pending: 'Waiting to score', scoring: 'Scoring', scored: 'Scored', failed: 'Scoring failed' },
    tones: { pending: 'neutral', scoring: 'ai', scored: 'success', failed: 'danger' },
    transitions: { pending: ['scoring', 'scored'], scoring: ['scored', 'failed'], scored: ['scoring'], failed: ['scoring'] },
  }),
  report: def<ReportStatus>({
    values: REPORT_STATUSES,
    labels: { pending: 'Waiting', generating: 'Writing report', ready: 'Ready', failed: 'Report failed' },
    tones: { pending: 'neutral', generating: 'ai', ready: 'success', failed: 'danger' },
    transitions: { pending: ['generating'], generating: ['ready', 'failed'], ready: ['generating'], failed: ['generating'] },
  }),
  task: def<TaskStatus>({
    values: TASK_STATUSES,
    labels: { open: 'Needs you', done: 'Done', dismissed: 'Dismissed' },
    tones: { open: 'warning', done: 'success', dismissed: 'neutral' },
    transitions: { open: ['done', 'dismissed'], done: none, dismissed: none },
  }),
};

export type StatusKind = keyof typeof MAP;
type ValueOf<K extends StatusKind> = (typeof MAP)[K] extends Def<infer V> ? V : never;

export type StatusValue<K extends StatusKind> = ValueOf<K>;

export function statusValues<K extends StatusKind>(kind: K): readonly ValueOf<K>[] {
  return MAP[kind].values as readonly ValueOf<K>[];
}

export function statusLabel<K extends StatusKind>(kind: K, value: ValueOf<K>): string {
  return (MAP[kind].labels as Record<string, string>)[value] ?? value;
}

export function statusTone<K extends StatusKind>(kind: K, value: ValueOf<K>): Tone {
  return (MAP[kind].tones as Record<string, Tone>)[value] ?? 'neutral';
}

export function allowedTransitions<K extends StatusKind>(kind: K, from: ValueOf<K>): readonly ValueOf<K>[] {
  return ((MAP[kind].transitions as Record<string, readonly string[]>)[from] ?? []) as readonly ValueOf<K>[];
}

export function canTransition<K extends StatusKind>(kind: K, from: ValueOf<K>, to: ValueOf<K>): boolean {
  return allowedTransitions(kind, from).includes(to);
}

export function assertTransition<K extends StatusKind>(kind: K, from: ValueOf<K>, to: ValueOf<K>): Result<true> {
  if (canTransition(kind, from, to)) return ok(true);
  return err('invalid_transition', `Can't move a ${kind} from "${from}" to "${to}".`, { kind, from, to });
}

export const TASK_TYPE_LABELS: Record<TaskType, string> = {
  follow_up: 'Follow up', review_submission: 'Review submission', schedule_interview: 'Schedule interview',
  missing_email: 'Add email', custom: 'Task',
};
