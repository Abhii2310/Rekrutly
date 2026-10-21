const TZ = 'Asia/Kolkata';

const dateTime = new Intl.DateTimeFormat('en-IN', {
  day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', hour12: true, timeZone: TZ,
});
const dateOnly = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: TZ });

const dayMonth = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', timeZone: TZ });

const toDate = (d: string | number | Date): Date => (d instanceof Date ? d : new Date(d));

/** "3 Nov" in India time. */
export function formatDate(d: string | number | Date): string {
  return dayMonth.format(toDate(d));
}

/** "3 Nov, 3:42 pm" in en-IN. */
export function formatDateTime(d: string | number | Date): string {
  return dateTime.format(toDate(d));
}

const timeOnly = new Intl.DateTimeFormat('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: TZ });

/** "3:42 pm" in India time. */
export function formatTime(d: string | number | Date): string {
  return timeOnly.format(toDate(d));
}

/** "just now", "5 min ago", "2 hours ago", "3 days ago", then a date. */
export function formatRelative(d: string | number | Date, now: string | number | Date = new Date()): string {
  const seconds = Math.round((toDate(now).getTime() - toDate(d).getTime()) / 1000);
  if (seconds < 45) return 'just now';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return hours === 1 ? '1 hour ago' : `${hours} hours ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return days === 1 ? 'yesterday' : `${days} days ago`;
  return dateOnly.format(toDate(d));
}

/** A ratio 0 to 1 as a whole-number percent. Null or NaN gives an en dash. */
export function formatPercent(ratio: number | null | undefined): string {
  if (ratio === null || ratio === undefined || Number.isNaN(ratio)) return '–';
  return `${Math.round(ratio * 100)}%`;
}
