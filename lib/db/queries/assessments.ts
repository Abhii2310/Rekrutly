import 'server-only';
import { getDb } from '@/lib/db/server';
import { err, ok, type Result } from '@/lib/result';
import type { AssessmentRow, QuestionKeyRow, QuestionRow } from '@/lib/db/types';

const ASSESSMENT_COLUMNS = 'id, job_id, run_id, title, instructions, duration_minutes, skills, status, is_demo, created_at, updated_at, published_at';
const QUESTION_COLUMNS = 'id, assessment_id, position, type, prompt, options, skill, difficulty, max_score, ai_generated, edited_by_recruiter, created_at, updated_at';
const KEY_COLUMNS = 'question_id, correct_option, rubric, explanation';

export type ReviewQuestion = QuestionRow & { key: Omit<QuestionKeyRow, 'question_id'> | null };
export type AssessmentForReview = { assessment: AssessmentRow; questions: ReviewQuestion[] };

/** Recruiter view: questions together with their answer keys. Never use this on a candidate route. */
export async function getAssessmentForReview(runId: string): Promise<Result<AssessmentForReview | null>> {
  const db = getDb();
  const a = await db.from('assessments').select(ASSESSMENT_COLUMNS).eq('run_id', runId).maybeSingle();
  if (a.error) return err('db_error', 'Could not load the assessment.', a.error.message);
  if (!a.data) return ok(null);
  const assessment = a.data as unknown as AssessmentRow;

  const qs = await db.from('questions').select(QUESTION_COLUMNS).eq('assessment_id', assessment.id).order('position');
  if (qs.error) return err('db_error', 'Could not load the questions.', qs.error.message);
  const questions = qs.data as unknown as QuestionRow[];
  const keys = await db.from('question_keys').select(KEY_COLUMNS).in('question_id', questions.map((q) => q.id));
  if (keys.error) return err('db_error', 'Could not load the answer keys.', keys.error.message);
  const byId = new Map((keys.data as unknown as QuestionKeyRow[]).map((k) => [k.question_id, k]));
  return ok({
    assessment,
    questions: questions.map((q) => {
      const k = byId.get(q.id);
      return { ...q, key: k ? { correct_option: k.correct_option, rubric: k.rubric, explanation: k.explanation } : null };
    }),
  });
}

export type QuestionContext = {
  question: QuestionRow;
  assessment: Pick<AssessmentRow, 'id' | 'job_id' | 'run_id' | 'status' | 'duration_minutes' | 'skills'>;
};

/** A question with the facts about its assessment that edit routes need (status, run, job). */
export async function getQuestionContext(questionId: string): Promise<Result<QuestionContext | null>> {
  const db = getDb();
  const q = await db.from('questions').select(QUESTION_COLUMNS).eq('id', questionId).maybeSingle();
  if (q.error) return err('db_error', 'Could not load the question.', q.error.message);
  if (!q.data) return ok(null);
  const question = q.data as unknown as QuestionRow;
  const a = await db.from('assessments').select('id, job_id, run_id, status, duration_minutes, skills').eq('id', question.assessment_id).maybeSingle();
  if (a.error || !a.data) return err('db_error', 'Could not load the assessment.', a.error?.message);
  return ok({ question, assessment: a.data as unknown as QuestionContext['assessment'] });
}

export async function getAssessmentContext(assessmentId: string): Promise<Result<QuestionContext['assessment'] | null>> {
  const a = await getDb().from('assessments').select('id, job_id, run_id, status, duration_minutes, skills').eq('id', assessmentId).maybeSingle();
  if (a.error) return err('db_error', 'Could not load the assessment.', a.error.message);
  return ok((a.data as unknown as QuestionContext['assessment'] | null) ?? null);
}
