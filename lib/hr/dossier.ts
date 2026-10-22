import 'server-only';
import { getDb } from '@/lib/db/server';
import { err, ok, type Result } from '@/lib/result';
import { ALERT_SIGNALS, signalLabel } from '@/lib/proctor/signals';
import type { ResumeMatch } from '@/lib/ats/rules';
import type { CandidateReport } from '@/lib/ai/schemas';
import type { Stage } from '@/lib/status';
import type { InterviewView, OfferView, Scorecard } from './types';

export type Dossier = {
  id: string;
  name: string;
  role: string | null;
  jobTitle: string | null;
  stage: Stage;
  email: string | null;
  location: string | null;
  yearsExperience: number | null;
  skills: string[];
  shortlisted: boolean;
  match: ResumeMatch | null;
  assessments: { title: string; finalPct: number | null; scored: boolean; submissionId: string | null; skills: { skill: string; percent: number }[]; summary: string | null; strengths: string[]; gaps: string[] }[];
  proctoring: { invitationId: string; flagged: number; kinds: { label: string; count: number }[] } | null;
  interviews: InterviewView[];
  offers: OfferView[];
};

type Skill = { skill: string; score: number; max: number; percent: number };

/** Everything known about one person, gathered in one place for the interview workspace and the portfolio page. Read-only. */
export async function getDossier(candidateId: string): Promise<Result<Dossier | null>> {
  const db = getDb();
  const [c, invs, iv, of] = await Promise.all([
    db.from('candidates').select('id, full_name, email, stage, location, years_experience, skills, current_title, current_company, resume_match, shortlisted, jobs(title)').eq('id', candidateId).maybeSingle(),
    db.from('invitations').select('id, assessments(title, proctored), submissions(id, final_score, final_max, scoring_status, skill_breakdown, report), integrity_signals(type)').eq('candidate_id', candidateId).order('created_at', { ascending: false }),
    db.from('interviews').select('id, scheduled_at, duration_minutes, status, notes, scorecard, email_status').eq('candidate_id', candidateId).order('scheduled_at', { ascending: false }),
    db.from('offers').select('id, title, compensation, start_date, body, status, sent_at').eq('candidate_id', candidateId).order('created_at', { ascending: false }),
  ]);
  const failed = [c, invs, iv, of].find((r) => r.error);
  if (failed?.error) return err('db_error', "Couldn't load the profile.", failed.error.message);
  if (!c.data) return ok(null);

  const cand = c.data as unknown as {
    id: string; full_name: string; email: string | null; stage: Stage; location: string | null; years_experience: number | null; skills: string[];
    current_title: string | null; current_company: string | null; resume_match: ResumeMatch | null; shortlisted: boolean; jobs: { title: string } | null;
  };
  type Sub = { id: string; final_score: number | null; final_max: number | null; scoring_status: string; skill_breakdown: Skill[] | null; report: CandidateReport | null };
  type Inv = { id: string; assessments: { title: string; proctored: boolean } | null; submissions: Sub[] | Sub | null; integrity_signals: { type: string }[] };

  const rows = invs.data as unknown as Inv[];
  const assessments = rows.flatMap((r) => {
    const sub = Array.isArray(r.submissions) ? r.submissions[0] : r.submissions;
    if (!sub) return [];
    const scored = sub.scoring_status === 'scored' && sub.final_score !== null && Number(sub.final_max) > 0;
    return [{
      title: r.assessments?.title ?? 'Assessment', finalPct: scored ? Math.round((Number(sub.final_score) / Number(sub.final_max)) * 100) : null, scored, submissionId: sub.id,
      skills: (sub.skill_breakdown ?? []).map((s) => ({ skill: s.skill, percent: s.percent })), summary: sub.report?.summary ?? null,
      strengths: (sub.report?.strengths ?? []).map((s) => s.skill), gaps: (sub.report?.gaps ?? []).map((g) => g.skill),
    }];
  });

  const recorded = rows.find((r) => r.assessments?.proctored);
  const counts = new Map<string, number>();
  for (const s of recorded?.integrity_signals ?? []) if (ALERT_SIGNALS.has(s.type)) counts.set(s.type, (counts.get(s.type) ?? 0) + 1);

  type IvRow = { id: string; scheduled_at: string; duration_minutes: number; status: InterviewView['status']; notes: string; scorecard: Scorecard | null; email_status: InterviewView['emailStatus'] };
  type OfRow = { id: string; title: string; compensation: string; start_date: string | null; body: string; status: OfferView['status']; sent_at: string | null };
  return ok({
    id: cand.id, name: cand.full_name, email: cand.email, stage: cand.stage, location: cand.location, yearsExperience: cand.years_experience, skills: cand.skills,
    role: cand.current_title && cand.current_company ? `${cand.current_title} at ${cand.current_company}` : cand.current_title, jobTitle: cand.jobs?.title ?? null,
    shortlisted: Boolean(cand.shortlisted), match: cand.resume_match, assessments,
    proctoring: recorded ? { invitationId: recorded.id, flagged: [...counts.values()].reduce((a, b) => a + b, 0), kinds: [...counts.entries()].map(([t, n]) => ({ label: signalLabel(t), count: n })) } : null,
    interviews: (iv.data as IvRow[]).map((i) => ({ id: i.id, scheduledAt: i.scheduled_at, durationMinutes: i.duration_minutes, status: i.status, notes: i.notes, scorecard: i.scorecard, emailStatus: i.email_status })),
    offers: (of.data as OfRow[]).map((o) => ({ id: o.id, title: o.title, compensation: o.compensation, startDate: o.start_date, body: o.body, status: o.status, sentAt: o.sent_at })),
  });
}
