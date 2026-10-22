import 'server-only';
import { ALERT_SIGNALS } from '@/lib/proctor/signals';
import { getDb } from '@/lib/db/server';
import { err, ok, type Result } from '@/lib/result';
import type { CandidateReport } from '@/lib/ai/schemas';
import type { Rubric, SkillBreakdown } from '@/lib/db/types';
import type { Stage } from '@/lib/status';

export type DetailQuestion = {
  id: string; position: number; type: 'mcq' | 'short'; prompt: string; options: string[] | null; skill: string; difficulty: string; max_score: number;
  key: { correct_option: number | null; rubric: Rubric | null; explanation: string | null } | null;
  answer: { selected_option: number | null; text_answer: string | null } | null;
  score: {
    id: string; method: 'auto' | 'ai_suggested'; score: number; max_score: number; is_correct: boolean | null; unanswered: boolean;
    reasoning: string | null; evidence_quote: string | null; matched_criteria: string[] | null; missing_criteria: string[] | null;
    confidence: 'low' | 'medium' | 'high' | null; overridden_score: number | null; override_reason: string | null;
  } | null;
};

export type SubmissionDetail = {
  id: string;
  submittedAt: string;
  startedAt: string | null;
  autoSubmitted: boolean;
  isSimulated: boolean;
  objective: { score: number | null; max: number | null };
  ai: { score: number | null; max: number | null };
  final: { score: number | null; max: number | null };
  skillBreakdown: SkillBreakdown;
  scoringStatus: 'pending' | 'scoring' | 'scored' | 'failed';
  scoringError: string | null;
  reportStatus: 'pending' | 'generating' | 'ready' | 'failed';
  reportError: string | null;
  report: CandidateReport | null;
  candidate: { id: string; name: string; stage: Stage };
  jobTitle: string;
  assessment: { id: string; title: string; runId: string | null };
  questions: DetailQuestion[];
  answeredCount: number;
  signals: { tab_hidden: number; paste: number; window_blur: number };
  /** Set when this assessment was recorded on camera: where the reviewer finds the recording. */
  recording: { invitationId: string; flagged: number } | null;
};

const num = (n: unknown): number | null => (n === null || n === undefined ? null : Number(n));

/** Recruiter view of one submission, with answer keys. Never use this on a candidate route. */
export async function getSubmissionDetail(id: string): Promise<Result<SubmissionDetail | null>> {
  const db = getDb();
  const s = await db.from('submissions').select(
    'id, invitation_id, submitted_at, auto_submitted, is_simulated, objective_score, objective_max, ai_suggested_score, ai_suggested_max, final_score, final_max, skill_breakdown, scoring_status, scoring_error, report, report_status, report_error',
  ).eq('id', id).maybeSingle();
  if (s.error) return err('db_error', "Couldn't load the submission.", s.error.message);
  if (!s.data) return ok(null);
  const sub = s.data as Record<string, unknown>;

  const inv = await db.from('invitations').select('id, assessment_id, candidate_id, started_at, candidates(id, full_name, stage), assessments(id, title, run_id, proctored, jobs(title))').eq('id', sub.invitation_id as string).single();
  if (inv.error || !inv.data) return err('db_error', "Couldn't load the candidate.", inv.error?.message);
  type InvJoin = { assessment_id: string; started_at: string | null; candidates: { id: string; full_name: string; stage: Stage } | null; assessments: { id: string; title: string; run_id: string | null; proctored: boolean; jobs: { title: string } | null } | null };
  const iv = inv.data as unknown as InvJoin;

  const [qs, ans, scores, signals] = await Promise.all([
    db.from('questions').select('id, position, type, prompt, options, skill, difficulty, max_score').eq('assessment_id', iv.assessment_id).order('position'),
    db.from('answers').select('question_id, selected_option, text_answer').eq('invitation_id', sub.invitation_id as string),
    db.from('question_scores').select('id, question_id, method, score, max_score, is_correct, unanswered, reasoning, evidence_quote, matched_criteria, missing_criteria, confidence, overridden_score, override_reason').eq('submission_id', id),
    db.from('integrity_signals').select('type').in('type', ['tab_hidden', 'paste', 'window_blur']).eq('invitation_id', sub.invitation_id as string),
  ]);
  const bad = [qs, ans, scores, signals].find((r) => r.error);
  if (bad?.error) return err('db_error', "Couldn't load the answers.", bad.error.message);
  const questions = qs.data as unknown as { id: string; position: number; type: 'mcq' | 'short'; prompt: string; options: string[] | null; skill: string; difficulty: string; max_score: number }[];
  const keys = await db.from('question_keys').select('question_id, correct_option, rubric, explanation').in('question_id', questions.map((q) => q.id));
  if (keys.error) return err('db_error', "Couldn't load the answer keys.", keys.error.message);

  const keyOf = new Map((keys.data as { question_id: string; correct_option: number | null; rubric: Rubric | null; explanation: string | null }[]).map((k) => [k.question_id, k]));
  const ansOf = new Map((ans.data as { question_id: string; selected_option: number | null; text_answer: string | null }[]).map((a) => [a.question_id, a]));
  type ScoreRow = NonNullable<DetailQuestion['score']> & { question_id: string };
  const scoreOf = new Map((scores.data as unknown as ScoreRow[]).map((r) => [r.question_id, r]));

  const detailQuestions: DetailQuestion[] = questions.map((q) => {
    const k = keyOf.get(q.id);
    const a = ansOf.get(q.id);
    const sc = scoreOf.get(q.id);
    return {
      ...q, max_score: Number(q.max_score),
      key: k ? { correct_option: k.correct_option, rubric: k.rubric, explanation: k.explanation } : null,
      answer: a ? { selected_option: a.selected_option, text_answer: a.text_answer } : null,
      score: sc ? { ...sc, score: Number(sc.score), max_score: Number(sc.max_score), overridden_score: num(sc.overridden_score) } : null,
    };
  });
  const answeredCount = detailQuestions.filter((q) => q.answer && (q.type === 'mcq' ? q.answer.selected_option !== null : Boolean(q.answer.text_answer?.trim()))).length;
  const flagged = await db.from('integrity_signals').select('id', { count: 'exact', head: true }).eq('invitation_id', sub.invitation_id as string).in('type', [...ALERT_SIGNALS]);
  const sigs = (signals.data as { type: keyof SubmissionDetail['signals'] }[]).reduce((acc, r) => ({ ...acc, [r.type]: acc[r.type] + 1 }), { tab_hidden: 0, paste: 0, window_blur: 0 });

  return ok({
    id, submittedAt: sub.submitted_at as string, startedAt: iv.started_at ?? null, autoSubmitted: Boolean(sub.auto_submitted), isSimulated: Boolean(sub.is_simulated),
    objective: { score: num(sub.objective_score), max: num(sub.objective_max) },
    ai: { score: num(sub.ai_suggested_score), max: num(sub.ai_suggested_max) },
    final: { score: num(sub.final_score), max: num(sub.final_max) },
    skillBreakdown: (sub.skill_breakdown as SkillBreakdown) ?? [],
    scoringStatus: sub.scoring_status as SubmissionDetail['scoringStatus'], scoringError: (sub.scoring_error as string | null) ?? null,
    reportStatus: sub.report_status as SubmissionDetail['reportStatus'], reportError: (sub.report_error as string | null) ?? null,
    report: (sub.report as CandidateReport | null) ?? null,
    candidate: { id: iv.candidates?.id ?? '', name: iv.candidates?.full_name ?? 'Candidate', stage: iv.candidates?.stage ?? 'assessment_submitted' },
    jobTitle: iv.assessments?.jobs?.title ?? 'this role',
    assessment: { id: iv.assessments?.id ?? '', title: iv.assessments?.title ?? 'Assessment', runId: iv.assessments?.run_id ?? null },
    questions: detailQuestions, answeredCount, signals: sigs,
    recording: iv.assessments?.proctored ? { invitationId: sub.invitation_id as string, flagged: flagged.count ?? 0 } : null,
  });
}
