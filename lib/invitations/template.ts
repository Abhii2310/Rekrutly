/** The fixed invitation text. Used for the preview in the review step and for real emails. */
export function invitationText(input: { firstName: string; role: string; durationMinutes: number; link?: string }): { subject: string; body: string } {
  const { firstName, role, durationMinutes, link } = input;
  const lines = [
    `Hi ${firstName},`,
    '',
    `Thanks for applying for the ${role} role. As the next step, we'd like you to take a short online assessment. It takes about ${durationMinutes} minutes, and you can only take it once.`,
    '',
    link ? `Start here: ${link}` : 'Start here: your personal link appears in this message.',
    '',
    "Your link is personal. Please don't share it.",
    '',
    'The hiring team',
  ];
  return { subject: `Your ${role} assessment`, body: lines.join('\n') };
}

export const firstNameOf = (fullName: string): string => fullName.trim().split(/\s+/)[0] ?? fullName;
