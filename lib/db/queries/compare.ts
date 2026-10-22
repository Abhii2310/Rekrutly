import 'server-only';
import { mcqSummary, minutesTaken, strongestEvidence, type Evidence } from '@/lib/analytics/compare';
import { getSubmissionDetail, type SubmissionDetail } from '@/lib/db/queries/submission';
import { err, ok, type Result } from '@/lib/result';

export type CompareSkill = { score: number; max: number; percent: number; evidence: Evidence | null; mcq: { correct: number; total: number } | null };
export type CompareCandidate = {
  submissionId: string; candidateId: string; name: string; isSimulated: boolean; scoring: SubmissionDetail['scoringStatus'];
  finalPct: number | null; objectivePct: number | null; aiPct: number | null; minutes: number | null; answered: number; total: number;
  skills: Record<string, CompareSkill>;
  probes: { skill: string; question: string; good: string }[];
};
export type Comparison = { assessment: { id: string; title: string; runId: string | null }; jobTitle: string; skills: string[]; candidates: CompareCandidate[] };

const pct = (s: number | null, m: number | null): number | null => (s !== null && m !== null && m > 0 ? Math.round((s / m) * 100) : null);

/** Loads 2 to 4 submissions of the same assessment, in the order given. No ranking: the order is the order you chose. */
export async function getComparison(ids: string[]): Promise<Result<Comparison>> {
  const details = await Promise.all(ids.map((id) => getSubmissionDetail(id)));
  const failed = details.find((d) => !d.ok);
  if (failed && !failed.ok) return err('db_error', "Couldn't load the submissions.", failed.error.message);
  const subs = details.map((d) => (d.ok ? d.data : null));
  if (subs.some((s) => s === null)) return err('not_found', 'One of the submissions could not be found.');
  const all = subs as SubmissionDetail[];
  const first = all[0] as SubmissionDetail;
  if (all.some((s) => s.assessment.id !== first.assessment.id)) {
    return err('different_assessment', 'These candidates took different assessments, so their scores cannot be compared side by side.');
  }

  const skills = [...new Set(first.questions.map((q) => q.skill))];
  const candidates: CompareCandidate[] = all.map((s) => ({
    submissionId: s.id, candidateId: s.candidate.id, name: s.candidate.name, isSimulated: s.isSimulated, scoring: s.scoringStatus,
    finalPct: s.scoringStatus === 'scored' ? pct(s.final.score, s.final.max) : null,
    objectivePct: pct(s.objective.score, s.objective.max),
    aiPct: pct(s.ai.score, s.ai.max),
    minutes: minutesTaken(s.startedAt, s.submittedAt),
    answered: s.answeredCount, total: s.questions.length,
    skills: Object.fromEntries(skills.map((skill) => {
      const b = s.skillBreakdown.find((k) => k.skill === skill);
      return [skill, { score: b?.score ?? 0, max: b?.max ?? 0, percent: b?.percent ?? 0, evidence: strongestEvidence(s.questions, skill), mcq: mcqSummary(s.questions, skill) }];
    })),
    probes: (s.report?.interview_questions ?? []).slice(0, 3).map((q) => ({ skill: q.skill, question: q.question, good: q.what_good_looks_like })),
  }));
  return ok({ assessment: first.assessment, jobTitle: first.jobTitle, skills, candidates });
}
