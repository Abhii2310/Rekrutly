import type { InvitationStatus } from '@/lib/status';

/** The middle column of a War Room row: where the candidate is. */
export function progressLabel(i: { status: InvitationStatus; current_question: number | null }, total: number): string {
  switch (i.status) {
    case 'started': return i.current_question ? `Question ${i.current_question} of ${total}` : 'Started';
    case 'submitted': return 'Submitted';
    case 'opened': return 'Opened the link';
    case 'expired': return 'Link expired';
    case 'revoked': return 'Link revoked';
    default: return 'Not started';
  }
}

/** 755 seconds becomes "12:35 left"; an hour or more becomes "1:02:03 left". */
export function clockLabel(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n: number): string => String(n).padStart(2, '0');
  return `${h > 0 ? `${h}:${pad(m)}` : String(m)}:${pad(sec)} left`;
}
