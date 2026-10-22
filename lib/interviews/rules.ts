/** Pure interview helpers: when the room opens, how a time reads, and the calendar link. */

export const OPENS_EARLY_MINUTES = 10;
export const STAYS_OPEN_MINUTES = 60;

export type JoinState = 'early' | 'open' | 'ended';

/** The candidate can join from 10 minutes before the start until an hour after it was due to end. */
export function joinState(now: Date, scheduledAt: Date, durationMinutes: number): JoinState {
  const opens = scheduledAt.getTime() - OPENS_EARLY_MINUTES * 60_000;
  const closes = scheduledAt.getTime() + (durationMinutes + STAYS_OPEN_MINUTES) * 60_000;
  if (now.getTime() < opens) return 'early';
  return now.getTime() > closes ? 'ended' : 'open';
}

/** For example "Friday, 24 October 2026, 3:30 pm IST". */
export function whenLabel(at: Date): string {
  const day = at.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Kolkata' });
  const time = at.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata' }).replace(/\s?(am|pm)/i, (m) => ` ${m.trim().toLowerCase()}`);
  return `${day}, ${time} IST`;
}

const stamp = (d: Date): string => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');

/** A "add to Google Calendar" link, so the candidate does not have to copy the time by hand. */
export function calendarLink(input: { title: string; start: Date; durationMinutes: number; details: string }): string {
  const end = new Date(input.start.getTime() + input.durationMinutes * 60_000);
  const q = new URLSearchParams({ action: 'TEMPLATE', text: input.title, dates: `${stamp(input.start)}/${stamp(end)}`, details: input.details });
  return `https://calendar.google.com/calendar/render?${q.toString()}`;
}

/** The invitation to the interview, as plain text. The same lines become the HTML email. */
export function interviewText(input: { firstName: string; role: string; start: Date; durationMinutes: number; joinUrl: string; calendarUrl: string }): { subject: string; body: string } {
  const lines = [
    `Hi ${input.firstName},`,
    '',
    `Thank you for your time so far. We would like to speak with you about the ${input.role} role.`,
    '',
    `When: ${whenLabel(input.start)}`,
    `How long: about ${input.durationMinutes} minutes`,
    '',
    `Join here: ${input.joinUrl}`,
    '',
    'Before the call',
    '- Open the link a few minutes early. It becomes active 10 minutes before the start.',
    '- Use a quiet place, a charged laptop or phone, and a stable connection. Headphones help.',
    '- It is a conversation: we will talk about your experience and your assessment.',
    '',
    `Add it to your calendar: ${input.calendarUrl}`,
    '',
    'If the time does not work, just reply to this email.',
    '',
    'See you then,',
    'The hiring team',
  ];
  return { subject: `Interview for the ${input.role} role: ${whenLabel(input.start)}`, body: lines.join('\n') };
}

/** Asks the candidate to choose one of a few times. The recruiter offers the choices; the candidate picks. */
export function proposalText(input: { firstName: string; role: string; slots: Date[]; durationMinutes: number; pickUrl: string }): { subject: string; body: string } {
  const lines = [
    `Hi ${input.firstName},`,
    '',
    `Thank you for your time so far. We would like to speak with you about the ${input.role} role. Please choose the time that suits you best:`,
    '',
    ...input.slots.map((s) => `- ${whenLabel(s)}`),
    '',
    `How long: about ${input.durationMinutes} minutes`,
    '',
    `Pick a time here: ${input.pickUrl}`,
    '',
    "Once you choose, you'll get a confirmation with the join link and a calendar link. If none of these work, just reply to this email.",
    '',
    'Thanks,',
    'The hiring team',
  ];
  return { subject: `Choose a time for your ${input.role} interview`, body: lines.join('\n') };
}

/** Offered times that have not passed yet. */
export const futureSlots = (slots: string[] | null, now: Date = new Date()): string[] => (slots ?? []).filter((s) => new Date(s).getTime() > now.getTime());

/** Sent about an hour before. Short: the time, and the way in. */
export function interviewReminderText(input: { firstName: string; role: string; start: Date; joinUrl: string }): { subject: string; body: string } {
  const lines = [
    `Hi ${input.firstName},`,
    '',
    `A reminder that your ${input.role} interview is coming up: ${whenLabel(input.start)}.`,
    '',
    `Join here: ${input.joinUrl}`,
    '',
    'The link turns on 10 minutes before the start. See you soon.',
    '',
    'The hiring team',
  ];
  return { subject: `Starting soon: your ${input.role} interview`, body: lines.join('\n') };
}
