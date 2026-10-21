import { err, ok, type Result } from '@/lib/result';

export type PortalState = 'invalid' | 'expired' | 'revoked' | 'ready' | 'in_progress' | 'time_up' | 'submitted';

export type InvitationTiming = {
  status: string;
  expires_at: string;
  started_at: string | null;
  deadline_at: string | null;
  submitted_at: string | null;
};

/** Writes are accepted this long after the deadline, so a save or submit in flight is never lost. */
export const GRACE_SECONDS = 30;

const ms = (iso: string): number => new Date(iso).getTime();

/** The database returns +00:00; the API always speaks the same ISO form (…Z) so equal instants compare equal. */
export const toIso = (iso: string | null): string | null => (iso ? new Date(iso).toISOString() : null);

/** Pure. What the candidate should see, from the invitation row and the server's clock. */
export function getPortalState(inv: InvitationTiming, now: Date): PortalState {
  if (inv.status === 'revoked') return 'revoked';
  if (inv.submitted_at || inv.status === 'submitted') return 'submitted';
  if (inv.started_at) {
    if (inv.deadline_at && now.getTime() > ms(inv.deadline_at)) return 'time_up';
    return 'in_progress';
  }
  if (inv.status === 'expired' || now.getTime() > ms(inv.expires_at)) return 'expired';
  return 'ready';
}

/** Pure. True while saves and submits are still accepted: until the deadline plus the grace period. */
export function isWithinDeadline(inv: Pick<InvitationTiming, 'deadline_at'>, now: Date, graceSeconds: number = GRACE_SECONDS): boolean {
  if (!inv.deadline_at) return false;
  return now.getTime() <= ms(inv.deadline_at) + graceSeconds * 1000;
}

/** Saves are allowed once started, before submitting, and inside the deadline plus grace. */
export function canWriteAnswers(inv: InvitationTiming, now: Date): boolean {
  const state = getPortalState(inv, now);
  return (state === 'in_progress' || state === 'time_up') && isWithinDeadline(inv, now);
}

export const MAX_TEXT_ANSWER = 5000;

export type QuestionForValidation = { type: 'mcq' | 'short'; options: string[] | null };
export type AnswerPayload = { selectedOption?: number | null; textAnswer?: string | null };
export type CleanAnswer = { selected_option: number | null; text_answer: string | null };

/** Pure. Checks an answer against the question it belongs to. */
export function validateAnswer(question: QuestionForValidation, payload: AnswerPayload): Result<CleanAnswer> {
  if (question.type === 'mcq') {
    const n = payload.selectedOption;
    if (n === null || n === undefined) return ok({ selected_option: null, text_answer: null });
    const max = question.options?.length ?? 0;
    if (!Number.isInteger(n) || n < 0 || n >= max) return err('invalid_answer', 'That option does not exist for this question.');
    return ok({ selected_option: n, text_answer: null });
  }
  if (payload.selectedOption !== null && payload.selectedOption !== undefined) return err('invalid_answer', 'This question takes a written answer.');
  const text = payload.textAnswer ?? '';
  if (text.length > MAX_TEXT_ANSWER) return err('answer_too_long', `Answers can be up to ${MAX_TEXT_ANSWER} characters.`);
  return ok({ selected_option: null, text_answer: text.length === 0 ? null : text });
}
