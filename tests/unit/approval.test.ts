import { describe, expect, it } from 'vitest';
import { buildSnapshot, stepTitles } from '@/lib/executor/approval';

const steps = [
  { id: 's1', action: 'generate_questions', title: 'Write 10 questions', requires_approval: false },
  { id: 's2', action: 'create_assessment', title: 'Create the assessment', requires_approval: true },
  { id: 's3', action: 'create_invitations', title: 'Create 2 candidate links', requires_approval: true },
  { id: 's4', action: 'send_invitations', title: 'Send invitations to 1 candidate with email', requires_approval: true },
  { id: 's5', action: 'track_submissions', title: 'Track submissions', requires_approval: false },
];

describe('buildSnapshot', () => {
  const snap = buildSnapshot({
    questionIds: ['q1', 'q2', 'q3'], durationMinutes: 45, roleTitle: 'Full-Stack Developer',
    recipients: [{ id: 'c1', name: 'Aarav Mehta', hasEmail: true }, { id: 'c2', name: 'Rohan Nair', hasEmail: false }], steps,
  });

  it('records what was shown: counts, duration, recipients and the step list', () => {
    expect(snap.question_count).toBe(3);
    expect(snap.question_ids).toEqual(['q1', 'q2', 'q3']);
    expect(snap.duration_minutes).toBe(45);
    expect(snap.recipients).toEqual([{ id: 'c1', name: 'Aarav Mehta', has_email: true }, { id: 'c2', name: 'Rohan Nair', has_email: false }]);
    expect(snap.steps.map((s) => s.action)).toEqual(steps.map((s) => s.action));
  });
  it('lists exactly the approval-requiring steps as approved', () => {
    expect(snap.approved_step_ids).toEqual(['s2', 's3', 's4']);
  });
  it('stores the invitation text with the first recipient, the role and the duration', () => {
    expect(snap.invitation_preview.body).toContain('Hi Aarav,');
    expect(snap.invitation_preview.body).toContain('about 45 minutes');
    expect(snap.invitation_preview.subject).toBe('Your Full-Stack Developer assessment');
  });
});

describe('stepTitles', () => {
  it('uses real numbers and singular forms', () => {
    expect(stepTitles(5, 4)).toEqual({ create_invitations: 'Create 5 candidate links', send_invitations: 'Send invitations to 4 candidates with email' });
    expect(stepTitles(1, 1)).toEqual({ create_invitations: 'Create 1 candidate link', send_invitations: 'Send invitations to 1 candidate with email' });
  });
  it('names the no-email case', () => {
    expect(stepTitles(3, 0).send_invitations).toBe('Send invitations by email');
  });
});
