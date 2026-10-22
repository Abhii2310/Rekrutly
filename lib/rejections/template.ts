/** A kind, plain rejection. The recruiter reads and edits it before anything is sent. It gives no reasons the recruiter has not typed. */
export function rejectionText(input: { firstName: string; role: string; signer?: string }): { subject: string; body: string } {
  const lines = [
    `Hi ${input.firstName},`,
    '',
    `Thank you for your interest in the ${input.role} role, and for the time you put into our process.`,
    '',
    `After careful consideration, we have decided not to move forward with your application this time. This was not an easy decision, and it says nothing about your potential.`,
    '',
    `We appreciate you taking the time to speak with us, and we wish you every success in your search.`,
    '',
    'Kind regards,',
    input.signer?.trim() || 'The hiring team',
  ];
  return { subject: `Your application for the ${input.role} role`, body: lines.join('\n') };
}
