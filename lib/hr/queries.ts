import 'server-only';
import { getDb } from '@/lib/db/server';
import { err, ok, type Result } from '@/lib/result';
import type { ResumeMatch } from '@/lib/ats/rules';
import type { HrData, InterviewView, OfferView, Scorecard } from './types';

type InterviewRow = { id: string; scheduled_at: string; duration_minutes: number; status: InterviewView['status']; proposed_slots: string[] | null; notes: string; scorecard: Scorecard | null; email_status: InterviewView['emailStatus'] };
type OfferRow = { id: string; title: string; compensation: string; start_date: string | null; body: string; status: OfferView['status']; sent_at: string | null; response: OfferView['response'] };

/** The hiring-flow data for one candidate. Fails softly, so a page still opens if the newest migration has not been run. */
export async function getHrData(candidateId: string): Promise<Result<HrData>> {
  const db = getDb();
  const [c, iv, of] = await Promise.all([
    db.from('candidates').select('resume_text, resume_match, shortlisted').eq('id', candidateId).maybeSingle(),
    db.from('interviews').select('id, scheduled_at, duration_minutes, status, proposed_slots, notes, scorecard, email_status').eq('candidate_id', candidateId).order('scheduled_at', { ascending: false }),
    db.from('offers').select('id, title, compensation, start_date, body, status, sent_at, response').eq('candidate_id', candidateId).order('created_at', { ascending: false }),
  ]);
  const failed = [c, iv, of].find((r) => r.error);
  if (failed?.error) return err('db_error', 'Hiring-flow data is not available.', failed.error.message);
  const row = c.data as { resume_text: string | null; resume_match: ResumeMatch | null; shortlisted: boolean } | null;
  return ok({
    resumeChars: row?.resume_text?.length ?? 0,
    match: row?.resume_match ?? null,
    shortlisted: Boolean(row?.shortlisted),
    interviews: (iv.data as InterviewRow[]).map((i) => ({ id: i.id, scheduledAt: i.scheduled_at, durationMinutes: i.duration_minutes, status: i.status, proposedSlots: i.proposed_slots, notes: i.notes, scorecard: i.scorecard, emailStatus: i.email_status })),
    offers: (of.data as OfferRow[]).map((o) => ({ id: o.id, title: o.title, compensation: o.compensation, startDate: o.start_date, body: o.body, status: o.status, sentAt: o.sent_at, response: o.response })),
  });
}

export type HrBadge = { score: number | null; shortlisted: boolean; interview: boolean; offer: boolean };

/** Small markers for the candidate list: match percent, shortlisted, interview booked, offer drafted. Empty if migration 0004 is missing. */
export async function listHrBadges(ids: string[]): Promise<Map<string, HrBadge>> {
  const out = new Map<string, HrBadge>();
  if (ids.length === 0) return out;
  const db = getDb();
  const [c, iv, of] = await Promise.all([
    db.from('candidates').select('id, resume_match, shortlisted').in('id', ids),
    db.from('interviews').select('candidate_id').in('candidate_id', ids).neq('status', 'cancelled'),
    db.from('offers').select('candidate_id').in('candidate_id', ids),
  ]);
  if (c.error || iv.error || of.error) return out;
  const interviews = new Set((iv.data as { candidate_id: string }[]).map((r) => r.candidate_id));
  const offers = new Set((of.data as { candidate_id: string }[]).map((r) => r.candidate_id));
  for (const r of c.data as { id: string; resume_match: ResumeMatch | null; shortlisted: boolean }[]) {
    out.set(r.id, { score: r.resume_match?.score ?? null, shortlisted: Boolean(r.shortlisted), interview: interviews.has(r.id), offer: offers.has(r.id) });
  }
  return out;
}

/** How many resumes on a role are waiting to be scored. Zero if the columns are missing. */
export async function countUnscored(jobId: string): Promise<number> {
  const { count, error } = await getDb().from('candidates').select('id', { count: 'exact', head: true }).eq('job_id', jobId).not('resume_text', 'is', null).is('resume_match', null);
  return error ? 0 : (count ?? 0);
}
