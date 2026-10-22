/** The offer letter is written from the details the recruiter types, by plain code, so nothing is invented. The recruiter edits it before it is sent. */
export type OfferInput = {
  candidateName: string;
  title: string;
  company: string;
  compensation: string;
  startDate: string | null;
  signerName: string;
  signerTitle: string;
  deadlineDays: number;
  /** Today, injected so the letter is testable. */
  today: Date;
};

const long = (d: Date): string => d.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Kolkata' });

export function offerLetter(i: OfferInput): { subject: string; body: string } {
  const deadline = new Date(i.today.getTime() + i.deadlineDays * 86_400_000);
  const start = i.startDate ? long(new Date(`${i.startDate}T00:00:00+05:30`)) : 'To be agreed with you';
  const lines = [
    long(i.today),
    '',
    `Dear ${i.candidateName},`,
    '',
    `We are delighted to offer you the position of ${i.title} at ${i.company}. Thank you for the time you put into our process.`,
    '',
    'The key terms are:',
    `- Position: ${i.title}`,
    `- Start date: ${start}`,
    `- Compensation: ${i.compensation || 'To be confirmed in your employment agreement'}`,
    '',
    'This letter summarises the main terms. A formal employment agreement with the full details will follow.',
    '',
    `Please confirm that you accept by replying to this email by ${long(deadline)}. If you have any questions before then, reply and we will be glad to talk them through.`,
    '',
    'We hope you will join us.',
    '',
    'Warm regards,',
    i.signerName,
    i.signerTitle ? `${i.signerTitle}, ${i.company}` : i.company,
  ];
  return { subject: `Your offer for the ${i.title} role at ${i.company}`, body: lines.join('\n') };
}

const esc = (t: string): string => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** The letter as a simple HTML email. Bullet lines become a list. */
export function offerHtml(body: string, replyUrl?: string): string {
  const blocks = body.split('\n\n').map((block) => {
    const lines = block.split('\n');
    const first = lines.findIndex((l) => l.startsWith('- '));
    if (first >= 0 && lines.slice(first).every((l) => l.startsWith('- '))) {
      const head = lines.slice(0, first).map(esc).join('<br>');
      return (head ? `<p style="margin:0 0 8px">${head}</p>` : '') + `<ul style="margin:0 0 16px;padding-left:20px">${lines.slice(first).map((l) => `<li style="margin:0 0 6px">${esc(l.slice(2))}</li>`).join('')}</ul>`;
    }
    return `<p style="margin:0 0 16px">${lines.map(esc).join('<br>')}</p>`;
  });
  const reply = replyUrl
    ? `<p style="margin:24px 0"><a href="${esc(replyUrl)}" style="display:inline-block;background:#0071E3;color:#ffffff;text-decoration:none;font-weight:600;padding:14px 28px;border-radius:999px">Review and reply to this offer</a></p>`
      + `<p style="margin:0 0 16px;color:#6e6e73;font-size:13px">You can accept or decline on that page. If the button does not work, copy this link: <a href="${esc(replyUrl)}" style="color:#0071E3;word-break:break-all">${esc(replyUrl)}</a></p>`
    : '';
  return `<div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;font-size:16px;line-height:1.55;color:#1d1d1f;max-width:600px">${blocks.join('')}${reply}</div>`;
}
