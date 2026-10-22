/** The fixed invitation text. Used for the preview in the review step and for real emails. Short on purpose. */
export function invitationText(input: { firstName: string; role: string; durationMinutes: number; link?: string; proctored?: boolean }): { subject: string; body: string } {
  const { firstName, role, durationMinutes, link, proctored } = input;
  const lines = [
    `Hi ${firstName},`,
    '',
    `Thanks for applying for the ${role} role. The next step is a short online assessment. It takes about ${durationMinutes} minutes and can only be taken once.`,
    '',
    link ? `Start here: ${link}` : 'Start here: your personal link appears in this message.',
    '',
    'What to expect',
    `- The timer starts when you press Start and can't be paused. Your answers save as you go.`,
    "- No account or sign-in. Your link is personal, so please don't share it.",
    ...(proctored
      ? [
          "- The assessment is recorded on your camera and microphone. You'll see a consent screen and a quick camera check first. Please sit alone in a quiet, well-lit room with your face in view.",
          "- Stay on the page: don't switch tabs or copy and paste. Anything unusual is flagged for a person to review. Nothing is decided automatically.",
        ]
      : ["- Stay on the page and don't paste answers in. A person reads every submission."]),
    '',
    'Good luck,',
    'The hiring team',
  ];
  return { subject: `Your next step for the ${role} role`, body: lines.join('\n') };
}

/** Sent once, right after a candidate submits. Says what happens next, and nothing about scores. */
export function submissionText(input: { firstName: string; role: string; autoSubmitted: boolean; proctored: boolean }): { subject: string; body: string } {
  const { firstName, role, autoSubmitted, proctored } = input;
  const lines = [
    `Hi ${firstName},`,
    '',
    `Thank you for completing the ${role} assessment. We've received your answers.`,
    ...(autoSubmitted ? ['', 'Your time ran out, so your answers were submitted automatically.'] : []),
    '',
    'What happens next',
    '- Our hiring team will review your submission. A person reads every one, and nothing is decided automatically.',
    "- We'll email you with the next steps. You don't need to do anything else, and you can close the exam page.",
    ...(proctored ? ['- The recording of your assessment is seen only by the hiring team.'] : []),
    '',
    'If you have any questions, just reply to this email.',
    '',
    'Thanks again,',
    'The hiring team',
  ];
  return { subject: `We've received your ${role} assessment`, body: lines.join('\n') };
}

/** A gentle once-only nudge for someone who has not started their assessment. */
export function examReminderText(input: { firstName: string; role: string; durationMinutes: number; link: string; expires: Date }): { subject: string; body: string } {
  const until = input.expires.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', timeZone: 'Asia/Kolkata' });
  const lines = [
    `Hi ${input.firstName},`,
    '',
    `A quick reminder that your ${input.role} assessment is still waiting for you. It takes about ${input.durationMinutes} minutes, and your link works until ${until}.`,
    '',
    `Start here: ${input.link}`,
    '',
    'If now is not a good time, pick a quiet moment before then. If something is in the way, just reply to this email.',
    '',
    'Thanks,',
    'The hiring team',
  ];
  return { subject: `Reminder: your ${input.role} assessment`, body: lines.join('\n') };
}

export const firstNameOf = (fullName: string): string => fullName.trim().split(/\s+/)[0] ?? fullName;

const esc = (t: string): string => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/**
 * The same invitation as a small HTML email with a real button, so the link cannot be broken by line wrapping or by a mail
 * app that does not recognise a plain-text link. The plain text is still sent alongside it.
 */
export function invitationHtml(body: string, link: string | undefined): string {
  const blocks = body.split('\n\n').map((block) => {
    const action = block.startsWith('Start here:') ? 'Start your assessment' : block.startsWith('Join here:') ? 'Join the interview' : block.startsWith('Pick a time here:') ? 'Choose a time' : null;
    if (link && action) {
      return `<p style="margin:24px 0"><a href="${esc(link)}" style="display:inline-block;background:#0071E3;color:#ffffff;text-decoration:none;font-weight:600;padding:14px 28px;border-radius:999px">${action}</a></p>`
        + `<p style="margin:0 0 16px;color:#6e6e73;font-size:13px">If the button does not work, copy this link into your browser:<br><a href="${esc(link)}" style="color:#0071E3;word-break:break-all">${esc(link)}</a></p>`;
    }
    const cal = /^Add it to your calendar: (https:\/\/\S+)$/.exec(block);
    if (cal) return `<p style="margin:0 0 16px"><a href="${esc(cal[1] as string)}" style="color:#0071E3">Add it to your calendar</a></p>`;
    const lines = block.split('\n');
    const firstBullet = lines.findIndex((l) => l.startsWith('- '));
    if (firstBullet >= 0 && lines.slice(firstBullet).every((l) => l.startsWith('- '))) {
      const head = lines.slice(0, firstBullet);
      return (head.length ? `<p style="margin:0 0 8px"><strong>${head.map(esc).join('<br>')}</strong></p>` : '')
        + `<ul style="margin:0 0 16px;padding-left:20px">${lines.slice(firstBullet).map((l) => `<li style="margin:0 0 6px">${esc(l.slice(2))}</li>`).join('')}</ul>`;
    }
    return `<p style="margin:0 0 16px">${lines.map(esc).join('<br>')}</p>`;
  });
  return `<div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;font-size:16px;line-height:1.5;color:#1d1d1f;max-width:560px">${blocks.join('')}</div>`;
}
