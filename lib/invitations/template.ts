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
          '- This assessment is recorded on your camera (video only, no sound). You will see a consent screen and a camera check first.',
          '- Sit in a quiet, well-lit room, alone, with your face in view of the camera for the whole assessment.',
          '- Allow camera access when your browser asks. Keep the page open and your camera on until you submit.',
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
