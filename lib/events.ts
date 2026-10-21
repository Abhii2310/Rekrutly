import 'server-only';
import { getDb } from '@/lib/db/server';
import { err, ok, type Result } from '@/lib/result';
import type { EventActor, EventLevel, Json } from '@/lib/db/types';

export const EVENT_TYPES = [
  'plan.created', 'plan.fallback_used', 'guardrail.triggered',
  'step.started', 'step.completed', 'step.failed',
  'run.paused', 'run.resumed', 'run.cancelled', 'run.completed', 'run.failed',
  'approval.granted', 'approval.cancelled',
  'question.regenerated', 'question.edited', 'question.added', 'question.deleted', 'questions.fallback_used',
  'assessment.updated',
  'invitation.created', 'invitation.link_copied', 'email.sent', 'email.failed', 'email.unconfigured',
  'candidate.opened', 'candidate.started', 'candidate.submitted', 'candidate.stage_changed',
  'candidate.updated', 'candidate.review_started',
  'score.objective_computed', 'score.ai_suggested', 'score.failed', 'score.overridden',
  'report.ready', 'report.failed',
  'followup.drafted', 'task.completed', 'task.dismissed',
  'system.seeded', 'demo.reset', 'demo.simulated',
] as const;
export type EventType = (typeof EVENT_TYPES)[number];

export const EVENT_TYPE_PATTERN = /^[a-z_]+\.[a-z_]+$/;

export type LogEventInput = {
  runId?: string | null;
  stepId?: string | null;
  jobId?: string | null;
  candidateId?: string | null;
  type: EventType;
  actor: EventActor;
  level?: EventLevel;
  message: string;
  data?: Json;
  isSimulated?: boolean;
};

/** Writes one append-only receipt. Never throws: callers get a Result and may ignore it. */
export async function logEvent(input: LogEventInput): Promise<Result<void>> {
  if (!EVENT_TYPE_PATTERN.test(input.type)) {
    return err('invalid_event_type', `Event type "${input.type}" must look like noun.verb.`);
  }
  try {
    const { error } = await getDb().from('workflow_events').insert({
      run_id: input.runId ?? null,
      step_id: input.stepId ?? null,
      job_id: input.jobId ?? null,
      candidate_id: input.candidateId ?? null,
      type: input.type,
      actor: input.actor,
      level: input.level ?? 'info',
      message: input.message,
      data: input.data ?? {},
      is_simulated: input.isSimulated ?? false,
    });
    if (error) {
      console.error(`logEvent(${input.type}) failed:`, error.message);
      return err('event_insert_failed', 'Could not record the receipt.');
    }
    return ok(undefined);
  } catch (e) {
    console.error(`logEvent(${input.type}) threw:`, e instanceof Error ? e.message : e);
    return err('event_insert_failed', 'Could not record the receipt.');
  }
}
