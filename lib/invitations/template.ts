/** The fixed invitation text. Used for the preview in the review step and for real emails. */
export function invitationText(input: { firstName: string; role: string; durationMinutes: number; link?: string; proctored?: boolean }): { subject: string; body: string } {
  const { firstName, role, durationMinutes, link, proctored } = input;
  const lines = [
    `Hi ${firstName},`,
    '',
    `Thanks for applying for the ${role} role. As the next step, we'd like you to take a short online assessment. It takes about ${durationMinutes} minutes, and you can only take it once.`,
    '',
    link ? `Start here: ${link}` : 'Start here: your personal link appears in this message.',
    '',
    "Your link is personal. Please don't share it. You don't need to create an account or sign in: the link is your way in.",
    '',
    'Before you start',
    `- Set aside ${durationMinutes} uninterrupted minutes. The timer starts when you press Start and cannot be paused.`,
    '- Use a laptop or desktop with Chrome, Edge or Safari, and a stable internet connection. A phone works too.',
    '- Close other tabs and apps. Answers save as you go, so a refresh will not lose your work.',
    ...(proctored
      ? [
          '- This assessment is recorded on your camera and microphone. You will see a consent screen and a camera check first.',
          '- Sit in a quiet, well-lit room, alone, with your face in view of the camera for the whole assessment. Please keep your eyes on the screen and do not talk or have others speak nearby.',
          '- Allow camera and microphone access when your browser asks. Keep the page open and your camera on until you submit.',
          '- Please do not switch tabs, copy or paste, or leave full screen. These moments are shown to the reviewer as signals to look at, never as proof, and nothing fails automatically.',
        ]
      : ['- Please do not switch tabs or paste text. These are shown to the reviewer as signals, not as proof.']),
    '- A person reviews your results. Nothing is decided automatically.',
    '',
    'Good luck.',
    'The hiring team',
  ];
  return { subject: `Your ${role} assessment`, body: lines.join('\n') };
}

export const firstNameOf = (fullName: string): string => fullName.trim().split(/\s+/)[0] ?? fullName;

const esc = (t: string): string => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/**
 * The same invitation as a small HTML email with a real button, so the link cannot be broken by line wrapping or by a mail
 * app that does not recognise a plain-text link. The plain text is still sent alongside it.
 */
export function invitationHtml(body: string, link: string | undefined): string {
  const blocks = body.split('\n\n').map((block) => {
    if (link && block.startsWith('Start here:')) {
      return `<p style="margin:24px 0"><a href="${esc(link)}" style="display:inline-block;background:#0071E3;color:#ffffff;text-decoration:none;font-weight:600;padding:14px 28px;border-radius:999px">Start your assessment</a></p>`
        + `<p style="margin:0 0 16px;color:#6e6e73;font-size:13px">If the button does not work, copy this link into your browser:<br><a href="${esc(link)}" style="color:#0071E3;word-break:break-all">${esc(link)}</a></p>`;
    }
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
