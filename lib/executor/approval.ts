import { firstNameOf, invitationText } from '@/lib/invitations/template';

export type SnapshotInput = {
  questionIds: string[];
  durationMinutes: number;
  recipients: { id: string; name: string; hasEmail: boolean }[];
  roleTitle: string;
  proctored?: boolean;
  aiInterview?: boolean;
  steps: { id: string; action: string; title: string; requires_approval: boolean }[];
};

/** Exactly what the recruiter saw when they approved. Stored as the approval's snapshot. */
export function buildSnapshot(i: SnapshotInput) {
  const first = i.recipients[0];
  const preview = invitationText({ firstName: first ? firstNameOf(first.name) : 'there', role: i.roleTitle, durationMinutes: i.durationMinutes, proctored: i.proctored, aiInterview: i.aiInterview });
  return {
    proctored: Boolean(i.proctored),
    ai_interview: Boolean(i.aiInterview),
    question_count: i.questionIds.length,
    question_ids: i.questionIds,
    duration_minutes: i.durationMinutes,
    recipients: i.recipients.map((r) => ({ id: r.id, name: r.name, has_email: r.hasEmail })),
    invitation_preview: preview,
    steps: i.steps.map((s) => ({ id: s.id, action: s.action, title: s.title })),
    /** One approval covers every approval-requiring step listed here; a step added later needs a new one. */
    approved_step_ids: i.steps.filter((s) => s.requires_approval).map((s) => s.id),
  };
}

/** Step titles with the real numbers after the recruiter changed the recipient list. */
export function stepTitles(recipientCount: number, emailCount: number): { create_invitations: string; send_invitations: string } {
  const links = `Create ${recipientCount} candidate ${recipientCount === 1 ? 'link' : 'links'}`;
  const send = emailCount > 0 ? `Send invitations to ${emailCount} ${emailCount === 1 ? 'candidate' : 'candidates'} with email` : 'Send invitations by email';
  return { create_invitations: links, send_invitations: send };
}
