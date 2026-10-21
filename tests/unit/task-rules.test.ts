import { describe, expect, it } from 'vitest';
import { computeNextActions } from '@/lib/tasks/next-actions';
import { clockLabel, progressLabel } from '@/lib/tasks/labels';
import type { PipelineInvitation } from '@/lib/tasks/pipeline';
import { keysToCreate, keysToResolve, selectTasks } from '@/lib/tasks/rules';
import { whatsappNumber, whatsappUrl } from '@/lib/tasks/whatsapp';

const NOW = new Date('2026-10-21T12:00:00Z');
const ago = (min: number): string => new Date(NOW.getTime() - min * 60_000).toISOString();

let n = 0;
function inv(over: Partial<PipelineInvitation> = {}): PipelineInvitation {
  n += 1;
  return {
    id: `inv-${n}`, candidateId: `cand-${n}`, name: `Person${n} Surname`, email: 'p@example.com', phone: null, stage: 'assessment_invited',
    status: 'sent', deliveryStatus: 'sent', createdAt: ago(10), currentQuestion: null, deadlineAt: null, submittedAt: null, lastActivityAt: null,
    submissionId: null, scoringStatus: null, reportStatus: null, ...over,
  };
}
const rules = (invitations: PipelineInvitation[], overdueMinutes = 5, interviewCandidates: { id: string; name: string }[] = []) =>
  selectTasks({ now: NOW, overdueMinutes, invitations, interviewCandidates });

describe('selectTasks', () => {
  it('nudges candidates who have not started after the overdue time, and not before', () => {
    const late = inv({ createdAt: ago(10) });
    const fresh = inv({ createdAt: ago(2) });
    const tasks = rules([late, fresh], 5);
    expect(tasks.map((t) => t.dedupeKey)).toEqual([`follow_up:${late.id}`]);
    expect(tasks[0]?.title).toBe('Nudge Person' + (n - 1) + ' to start');
  });
  it('counts opened but not started as not started, and started as started', () => {
    const opened = inv({ status: 'opened' });
    const started = inv({ status: 'started' });
    const keys = rules([opened, started]).map((t) => t.dedupeKey);
    expect(keys).toContain(`follow_up:${opened.id}`);
    expect(keys).not.toContain(`follow_up:${started.id}`);
  });
  it('asks for an email when a candidate has none, unless they already submitted', () => {
    const none = inv({ email: null, createdAt: ago(1) });
    const done = inv({ email: null, status: 'submitted' });
    const keys = rules([none, done]).map((t) => t.dedupeKey);
    expect(keys).toEqual([`missing_email:${none.candidateId}`]);
  });
  it('asks for a review once scored and the candidate has not been opened for review', () => {
    const ready = inv({ status: 'submitted', stage: 'assessment_submitted', submissionId: 'sub-1', scoringStatus: 'scored' });
    const reviewed = inv({ status: 'submitted', stage: 'under_review', submissionId: 'sub-2', scoringStatus: 'scored' });
    const scoring = inv({ status: 'submitted', stage: 'assessment_submitted', submissionId: 'sub-3', scoringStatus: 'scoring' });
    expect(rules([ready, reviewed, scoring]).map((t) => t.dedupeKey)).toEqual(['review_submission:sub-1']);
  });
  it('asks to schedule an interview for candidates in the interview stage', () => {
    const t = rules([], 5, [{ id: 'c-9', name: 'Meera Rao' }]);
    expect(t).toHaveLength(1);
    expect(t[0]).toMatchObject({ dedupeKey: 'schedule_interview:c-9', type: 'schedule_interview', title: 'Schedule an interview with Meera' });
  });
  it('never puts a protected characteristic or a ranking in a task', () => {
    const text = JSON.stringify(rules([inv(), inv({ email: null })])).toLowerCase();
    for (const word of ['best', 'recommended', 'age', 'gender', 'caste', 'religion']) expect(text).not.toMatch(new RegExp(`\\b${word}\\b`));
  });
});

describe('closing and creating tasks', () => {
  it('closes managed open tasks whose condition is gone (candidate started)', () => {
    const waiting = inv();
    const wanted = rules([waiting]);
    const open = [`follow_up:${waiting.id}`, 'follow_up:gone', 'missing_email:gone', null, 'custom:thing'];
    expect(keysToResolve(open, wanted)).toEqual(['follow_up:gone', 'missing_email:gone']);
    const started = { ...waiting, status: 'started' as const };
    expect(keysToResolve([`follow_up:${waiting.id}`], rules([started]))).toEqual([`follow_up:${waiting.id}`]);
  });
  it('creates only tasks that do not exist yet, so a finished task is never reopened', () => {
    const a = inv();
    const wanted = rules([a]);
    expect(keysToCreate([], wanted)).toHaveLength(1);
    expect(keysToCreate([`follow_up:${a.id}`], wanted)).toHaveLength(0); // open, done or dismissed all count as existing
  });
});

describe('computeNextActions', () => {
  it('writes the sentences from the brief', () => {
    const a = inv({ name: 'Diya Raghunathan', status: 'submitted', stage: 'assessment_submitted', submissionId: 's', scoringStatus: 'scored' });
    const b = inv({ status: 'sent' });
    const c = inv({ status: 'created' });
    const d = inv({ name: 'Rohan Nair', email: null, status: 'started' });
    const out = computeNextActions([a, b, c, d], 2);
    expect(out).toContain("Diya's report is ready to review.");
    expect(out).toContain("2 candidates haven't started. Send a nudge.");
    expect(out).toContain('Rohan has no email. Share the link on WhatsApp or add an email.');
    expect(out.length).toBeLessThanOrEqual(4);
  });
  it('only says "send a nudge" when a nudge task exists', () => {
    expect(computeNextActions([inv()], 0)).toEqual(["1 candidate hasn't started."]);
  });
  it('reports failed scoring and a finished pipeline', () => {
    expect(computeNextActions([inv({ name: 'Aarav Mehta', status: 'submitted', scoringStatus: 'failed', submissionId: 's' })], 0)[0]).toBe('Scoring failed for Aarav. Open the submission and retry.');
    expect(computeNextActions([inv({ status: 'submitted' }), inv({ status: 'submitted' })], 0)).toEqual(['Everyone has submitted.']);
    expect(computeNextActions([], 0)).toEqual([]);
  });
  it('never returns more than four sentences', () => {
    const many = [
      inv({ status: 'submitted', stage: 'assessment_submitted', submissionId: 'a', scoringStatus: 'scored' }),
      inv({ status: 'submitted', scoringStatus: 'failed', submissionId: 'b' }),
      inv({ email: null }), inv({ status: 'started' }),
    ];
    expect(computeNextActions(many, 1).length).toBe(4);
  });
});

describe('war room labels', () => {
  it('describes where a candidate is', () => {
    expect(progressLabel({ status: 'started', current_question: 4 }, 10)).toBe('Question 4 of 10');
    expect(progressLabel({ status: 'started', current_question: null }, 10)).toBe('Started');
    expect(progressLabel({ status: 'sent', current_question: null }, 10)).toBe('Not started');
    expect(progressLabel({ status: 'submitted', current_question: 10 }, 10)).toBe('Submitted');
  });
  it('formats the time left', () => {
    expect(clockLabel(751)).toBe('12:31 left');
    expect(clockLabel(59)).toBe('0:59 left');
    expect(clockLabel(3723)).toBe('1:02:03 left');
    expect(clockLabel(-5)).toBe('0:00 left');
  });
});

describe('whatsapp', () => {
  it('builds a well-formed wa.me link', () => {
    expect(whatsappNumber('+91 98765 43210')).toBe('919876543210');
    expect(whatsappNumber('098765 43210')).toBe('919876543210');
    expect(whatsappNumber('9876543210')).toBe('919876543210');
    expect(whatsappNumber('12345')).toBeNull();
    expect(whatsappNumber(null)).toBeNull();
    expect(whatsappUrl('+91 98765 43210', 'Hi Diya, ready? & more')).toBe('https://wa.me/919876543210?text=Hi%20Diya%2C%20ready%3F%20%26%20more');
    expect(whatsappUrl(null, 'x')).toBeNull();
  });
});
