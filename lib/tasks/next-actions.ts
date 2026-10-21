import { firstName, NOT_STARTED, type PipelineInvitation } from './pipeline';

const join = (names: string[]): string =>
  names.length <= 2 ? names.join(' and ') : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;

/**
 * Pure. Up to four plain sentences about what the recruiter could do next, in priority order. Rules only, no model.
 * `overdueFollowUps` is how many open nudge tasks exist (candidates who are late to start).
 */
export function computeNextActions(invitations: PipelineInvitation[], overdueFollowUps: number): string[] {
  const out: string[] = [];
  if (invitations.length === 0) return out;

  const ready = invitations.filter((i) => i.submissionId && i.scoringStatus === 'scored' && i.stage === 'assessment_submitted');
  if (ready.length === 1 && ready[0]) out.push(`${firstName(ready[0].name)}'s report is ready to review.`);
  else if (ready.length > 1) out.push(`${ready.length} reports are ready to review.`);

  const scoringFailed = invitations.filter((i) => i.scoringStatus === 'failed');
  if (scoringFailed.length > 0) {
    out.push(`Scoring failed for ${join(scoringFailed.map((i) => firstName(i.name)))}. Open the submission and retry.`);
  }

  const notStarted = invitations.filter((i) => NOT_STARTED.includes(i.status));
  if (notStarted.length > 0) {
    const n = notStarted.length;
    out.push(`${n} ${n === 1 ? 'candidate hasn\'t' : 'candidates haven\'t'} started.${overdueFollowUps > 0 ? ' Send a nudge.' : ''}`);
  }

  const noEmail = invitations.filter((i) => !i.email && i.status !== 'submitted' && i.status !== 'revoked');
  if (noEmail.length === 1 && noEmail[0]) out.push(`${firstName(noEmail[0].name)} has no email. Share the link on WhatsApp or add an email.`);
  else if (noEmail.length > 1) out.push(`${noEmail.length} candidates have no email. Share their links on WhatsApp or add emails.`);

  const inProgress = invitations.filter((i) => i.status === 'started').length;
  if (inProgress > 0) out.push(`${inProgress} ${inProgress === 1 ? 'candidate is' : 'candidates are'} taking the test now.`);

  if (out.length === 0 && invitations.every((i) => i.status === 'submitted')) out.push('Everyone has submitted.');
  return out.slice(0, 4);
}
