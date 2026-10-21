import 'server-only';
import { generateReport } from '@/lib/ai/report';
import { getDb } from '@/lib/db/server';
import type { Rubric } from '@/lib/db/types';
import { env } from '@/lib/env';
import { logEvent } from '@/lib/events';
import { setRunStatus } from '@/lib/executor/run-status';
import { aggregate, type AggQuestion, type AggScore } from './aggregate';
import { buildEvidence, type ResultForReport } from './evidence';
import { guardPipeline, mapWithConcurrency } from './safe';
import { gradeShortAnswer, unansweredGrade } from './short-answer';

type Ctx = {
  submissionId: string;
  invitationId: string;
  assessmentId: string;
  runId: string | null;
  jobId: string;
  jobTitle: string;
  skills: string[];
  firstName: string;
  candidateId: string;
  scoringStatus: string;
  reportStatus: string;
};

type QuestionRow = { id: string; type: 'mcq' | 'short'; prompt: string; skill: string; max_score: number; position: number };
type ScoreRow = AggScore & { id: string; unanswered: boolean; evidence_quote: string | null };

async function loadContext(submissionId: string): Promise<Ctx | null> {
  const { data } = await getDb()
    .from('submissions')
    .select('id, invitation_id, scoring_status, report_status, invitations(assessment_id, candidate_id, assessments(run_id, job_id, skills, jobs(title, skills)), candidates(full_name))')
    .eq('id', submissionId).maybeSingle();
  if (!data) return null;
  type Joined = { assessment_id: string; candidate_id: string; assessments: { run_id: string | null; job_id: string; skills: string[]; jobs: { title: string; skills: string[] } | null }; candidates: { full_name: string } | null };
  const inv = (data as unknown as { invitations: Joined }).invitations;
  const skills = [...new Set([...(inv.assessments.skills ?? []), ...(inv.assessments.jobs?.skills ?? [])])];
  return {
    submissionId, invitationId: data.invitation_id as string, assessmentId: inv.assessment_id, runId: inv.assessments.run_id, jobId: inv.assessments.job_id,
    jobTitle: inv.assessments.jobs?.title ?? 'this role', skills, firstName: (inv.candidates?.full_name ?? 'the candidate').split(/\s+/)[0] ?? 'the candidate',
    candidateId: inv.candidate_id, scoringStatus: data.scoring_status as string, reportStatus: data.report_status as string,
  };
}

/** Marks the scoring step of the run and, once everyone is settled, completes it and the run. */
export async function updateScoreStep(assessmentId: string, runId: string | null, jobId: string | null): Promise<void> {
  if (!runId) return;
  const db = getDb();
  const [inv, subs, step] = await Promise.all([
    db.from('invitations').select('id, status').eq('assessment_id', assessmentId),
    db.from('submissions').select('invitation_id, scoring_status, report_status'),
    db.from('workflow_steps').select('id, status').eq('run_id', runId).eq('action', 'score_and_report').maybeSingle(),
  ]);
  if (!inv.data || !subs.data || !step.data) return;
  const invIds = new Set((inv.data as { id: string }[]).map((i) => i.id));
  const mine = (subs.data as { invitation_id: string; scoring_status: string; report_status: string }[]).filter((s) => invIds.has(s.invitation_id));
  const total = inv.data.length;
  const settled = mine.filter((s) => ['scored', 'failed'].includes(s.scoring_status) && ['ready', 'failed'].includes(s.report_status)).length;
  const allIn = (inv.data as { status: string }[]).every((i) => ['submitted', 'expired', 'revoked'].includes(i.status));
  const done = allIn && mine.length > 0 && settled === mine.length;
  const message = `Scored ${settled} of ${total}`;
  const status = step.data.status as string;

  if (done) {
    await db.from('workflow_steps').update({ status: 'completed', result: { message, scored: settled, total }, finished_at: new Date().toISOString() }).eq('id', step.data.id as string);
    await logEvent({ runId, stepId: step.data.id as string, jobId, type: 'step.completed', actor: 'agent', level: 'success', message });
    const completed = await setRunStatus(runId, 'completed', { completed_at: new Date().toISOString() });
    if (completed.ok) await logEvent({ runId, jobId, type: 'run.completed', actor: 'agent', level: 'success', message: 'Workflow finished' });
  } else if (mine.length > 0 && ['planned', 'waiting'].includes(status)) {
    await db.from('workflow_steps').update({ status: 'waiting', result: { message, scored: settled, total } }).eq('id', step.data.id as string);
  }
}

async function loadScoringData(c: Ctx) {
  const db = getDb();
  const [qs, ans, scores] = await Promise.all([
    db.from('questions').select('id, type, prompt, skill, max_score, position').eq('assessment_id', c.assessmentId).order('position'),
    db.from('answers').select('question_id, text_answer').eq('invitation_id', c.invitationId),
    db.from('question_scores').select('id, question_id, method, score, max_score, overridden_score, unanswered, evidence_quote').eq('submission_id', c.submissionId),
  ]);
  if (qs.error || ans.error || scores.error) throw new Error("Couldn't load the submission.");
  const questions = qs.data as unknown as QuestionRow[];
  // Rubrics are read here, in lib/scoring, and nowhere on a candidate route.
  const keys = await db.from('question_keys').select('question_id, rubric').in('question_id', questions.filter((q) => q.type === 'short').map((q) => q.id));
  if (keys.error) throw new Error("Couldn't load the rubrics.");
  return {
    questions,
    answers: new Map((ans.data as { question_id: string; text_answer: string | null }[]).map((a) => [a.question_id, a.text_answer ?? ''])),
    rubrics: new Map((keys.data as { question_id: string; rubric: Rubric | null }[]).map((k) => [k.question_id, k.rubric])),
    scores: scores.data as unknown as ScoreRow[],
  };
}

/** Recomputes the totals and the skill breakdown from the score rows (overrides included) and stores them. */
export async function recomputeSubmission(submissionId: string): Promise<void> {
  const c = await loadContext(submissionId);
  if (!c) return;
  const d = await loadScoringData(c);
  const agg = aggregate(d.questions as AggQuestion[], d.scores);
  await getDb().from('submissions').update({
    objective_score: agg.objective.score, objective_max: agg.objective.max,
    ai_suggested_score: agg.ai.max > 0 ? agg.ai.score : null, ai_suggested_max: agg.ai.max > 0 ? agg.ai.max : null,
    final_score: agg.final.score, final_max: agg.final.max, skill_breakdown: agg.skill_breakdown,
  }).eq('id', submissionId);
}

async function gradeAndAggregate(c: Ctx): Promise<void> {
  const db = getDb();
  const d = await loadScoringData(c);
  const have = new Set(d.scores.map((s) => s.question_id));
  const todo = d.questions.filter((q) => q.type === 'short' && !have.has(q.id));

  // Free-tier Google allows one request at a time; other providers take three.
  const limit = env.AI_PROVIDER === 'google' ? 1 : 3;
  await mapWithConcurrency(todo, limit, async (q) => {
    const answer = d.answers.get(q.id) ?? '';
    const rubric = d.rubrics.get(q.id);
    if (!answer.trim()) {
      const g = unansweredGrade();
      await db.from('question_scores').upsert({
        submission_id: c.submissionId, question_id: q.id, method: 'auto', score: 0, max_score: q.max_score, unanswered: true,
        reasoning: g.reasoning, matched_criteria: [], missing_criteria: [], confidence: g.confidence,
      }, { onConflict: 'submission_id,question_id' });
      return;
    }
    if (!rubric) throw new Error('A written question has no rubric.');
    const res = await gradeShortAnswer({ prompt: q.prompt, skill: q.skill, maxScore: Number(q.max_score), rubric, answer });
    if (!res.ok) throw new Error(res.error.message);
    const g = res.data.grade;
    const saved = await db.from('question_scores').upsert({
      submission_id: c.submissionId, question_id: q.id, method: 'ai_suggested', score: g.score, max_score: q.max_score, unanswered: false,
      reasoning: g.reasoning, evidence_quote: g.evidence_quote, matched_criteria: g.matched_criteria, missing_criteria: g.missing_criteria, confidence: g.confidence,
    }, { onConflict: 'submission_id,question_id' });
    if (saved.error) throw new Error("Couldn't save a grade.");
  });

  await recomputeSubmission(c.submissionId);
  await db.from('submissions').update({ scoring_status: 'scored', scoring_error: null }).eq('id', c.submissionId);
  await logEvent({
    runId: c.runId, jobId: c.jobId, candidateId: c.candidateId, type: 'score.ai_suggested', actor: 'agent', level: 'success',
    message: `Reviewed ${todo.length} written ${todo.length === 1 ? 'answer' : 'answers'} for ${c.firstName}. Scores are suggestions for you to check.`,
    data: { graded: todo.length },
  });
}

async function writeReport(c: Ctx): Promise<void> {
  const db = getDb();
  const d = await loadScoringData(c);
  const results: ResultForReport[] = d.scores.flatMap((s) => {
    const q = d.questions.find((x) => x.id === s.question_id);
    if (!q) return [];
    return [{
      skill: q.skill, type: q.type, promptSummary: q.prompt, score: Number(s.overridden_score ?? s.score), max: Number(s.max_score),
      unanswered: s.unanswered, evidenceQuote: s.evidence_quote, method: s.method,
    }];
  });
  const skills = [...new Set(d.questions.map((q) => q.skill))];
  const evidence = buildEvidence(results, skills[0] ?? 'General');
  // Only skills this assessment actually asked about, so the report never talks about skills it has no evidence for.
  const res = await generateReport({ jobTitle: c.jobTitle, skills, evidence });
  if (!res.ok) throw new Error(res.error.message);
  await db.from('submissions').update({ report: res.data.report, report_status: 'ready', report_error: null }).eq('id', c.submissionId);
  await logEvent({
    runId: c.runId, jobId: c.jobId, candidateId: c.candidateId, type: 'report.ready', actor: 'agent', level: 'success',
    message: `The report for ${c.firstName} is ready`, data: { ai_provider: res.data.meta.provider, ai_model: res.data.meta.model },
  });
}

async function runCore(submissionId: string): Promise<void> {
  const db = getDb();
  const c = await loadContext(submissionId);
  if (!c) return;

  // Only one run may grade at a time; a second call while grading does nothing.
  if (c.scoringStatus !== 'scored') {
    const claimed = await db.from('submissions').update({ scoring_status: 'scoring', scoring_error: null })
      .eq('id', submissionId).in('scoring_status', ['pending', 'failed']).select('id');
    if (!claimed.data || claimed.data.length === 0) return;
    await gradeAndAggregate(c);
  }

  if (c.reportStatus !== 'ready') {
    const claimed = await db.from('submissions').update({ report_status: 'generating', report_error: null })
      .eq('id', submissionId).in('report_status', ['pending', 'failed']).select('id');
    if (claimed.data && claimed.data.length > 0) {
      try {
        await writeReport(c);
      } catch (e) {
        const message = e instanceof Error ? e.message : 'The report failed.';
        await db.from('submissions').update({ report_status: 'failed', report_error: message }).eq('id', submissionId);
        await logEvent({ runId: c.runId, jobId: c.jobId, candidateId: c.candidateId, type: 'report.failed', actor: 'agent', level: 'error', message: `Couldn't write the report for ${c.firstName}: ${message}` });
      }
    }
  }
  await updateScoreStep(c.assessmentId, c.runId, c.jobId);
}

async function markScoringFailed(error: unknown, submissionId: string): Promise<void> {
  const message = (error instanceof Error ? error.message : 'Scoring failed.').slice(0, 300);
  const c = await loadContext(submissionId);
  await getDb().from('submissions').update({ scoring_status: 'failed', scoring_error: message }).eq('id', submissionId);
  if (c) {
    await logEvent({ runId: c.runId, jobId: c.jobId, candidateId: c.candidateId, type: 'score.failed', actor: 'agent', level: 'error', message: `Couldn't review the written answers for ${c.firstName}: ${message}` });
    await updateScoreStep(c.assessmentId, c.runId, c.jobId);
  }
}

/**
 * Grades written answers, aggregates, writes the report and updates the run. Called from `after()` in the submit
 * route and from the rescore route. It never throws: the submission and the multiple-choice score were saved first.
 * Safe to call again: it only does what is missing (already graded questions and a ready report are skipped).
 */
export const runPostSubmitPipeline = guardPipeline(runCore, markScoringFailed);
