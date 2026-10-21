import 'server-only';
import { getDb } from '@/lib/db/server';
import { err, ok, type Result } from '@/lib/result';
import type { GeneratedQuestion } from '@/lib/ai/schemas';
import type { QuestionKeyInsert } from '@/lib/db/types';
import type { QuestionPatch } from '@/lib/validation/questions';

export const MIN_QUESTIONS = 3;

export const DEFAULT_INSTRUCTIONS =
  'Answer every question. You can move back and forth between questions and your answers are saved as you go. The timer starts when you press Start and cannot be paused. Take your time on the written answers: a few clear sentences is enough.';

type NewQuestion = GeneratedQuestion & { ai_generated?: boolean };

function questionRow(q: NewQuestion, assessmentId: string, position: number) {
  return {
    assessment_id: assessmentId, position, type: q.type, prompt: q.prompt,
    options: q.type === 'mcq' ? q.options : null, skill: q.skill, difficulty: q.difficulty,
    max_score: q.max_score, ai_generated: q.ai_generated ?? true,
  };
}

function keyRow(q: NewQuestion, questionId: string): QuestionKeyInsert {
  return q.type === 'mcq'
    ? { question_id: questionId, correct_option: q.correct_option, rubric: null, explanation: q.explanation ?? null }
    : { question_id: questionId, correct_option: null, rubric: q.rubric, explanation: null };
}

/** Inserts questions then their keys. Returns the new question IDs in order. */
async function insertQuestions(assessmentId: string, qs: NewQuestion[], startAt: number): Promise<Result<string[]>> {
  const db = getDb();
  const rows = qs.map((q, i) => questionRow(q, assessmentId, startAt + i));
  const inserted = await db.from('questions').insert(rows).select('id, position');
  if (inserted.error) return err('db_error', "Couldn't save the questions.", inserted.error.message);
  const ids = (inserted.data as { id: string; position: number }[]).sort((a, b) => a.position - b.position).map((r) => r.id);
  const keys = await db.from('question_keys').insert(qs.map((q, i) => keyRow(q, ids[i] as string)));
  if (keys.error) return err('db_error', "Couldn't save the answer keys.", keys.error.message);
  return ok(ids);
}

export type DraftInput = {
  runId: string; jobId: string; title: string; instructions?: string; durationMinutes: number;
  skills: string[]; isDemo: boolean; questions: GeneratedQuestion[];
};

/** Creates a draft assessment with its questions and keys. Cleans up the assessment if a later insert fails. */
export async function createDraftAssessment(input: DraftInput): Promise<Result<{ assessmentId: string; questionIds: string[] }>> {
  const db = getDb();
  const a = await db.from('assessments').insert({
    run_id: input.runId, job_id: input.jobId, title: input.title, instructions: input.instructions ?? DEFAULT_INSTRUCTIONS,
    duration_minutes: input.durationMinutes, skills: input.skills, status: 'draft', is_demo: input.isDemo,
  }).select('id').single();
  if (a.error) return err('db_error', "Couldn't create the assessment.", a.error.message);
  const assessmentId = a.data.id as string;

  const ids = await insertQuestions(assessmentId, input.questions, 0);
  if (!ids.ok) {
    await db.from('assessments').delete().eq('id', assessmentId); // cascades to questions and keys
    return ids;
  }
  return ok({ assessmentId, questionIds: ids.data });
}

/** Replaces every question and key of a draft assessment (regenerate all). */
export async function replaceAllQuestions(assessmentId: string, questions: GeneratedQuestion[]): Promise<Result<string[]>> {
  const db = getDb();
  const del = await db.from('questions').delete().eq('assessment_id', assessmentId);
  if (del.error) return err('db_error', "Couldn't clear the old questions.", del.error.message);
  return insertQuestions(assessmentId, questions, 0);
}

export async function addQuestion(assessmentId: string, q: GeneratedQuestion): Promise<Result<string>> {
  const db = getDb();
  const last = await db.from('questions').select('position').eq('assessment_id', assessmentId).order('position', { ascending: false }).limit(1);
  if (last.error) return err('db_error', "Couldn't add the question.", last.error.message);
  const next = ((last.data?.[0]?.position as number | undefined) ?? -1) + 1;
  const ids = await insertQuestions(assessmentId, [{ ...q, ai_generated: false }], next);
  if (!ids.ok) return ids;
  return ok(ids.data[0] as string);
}

/** Overwrites a question's content and key (used by regenerate). */
export async function overwriteQuestion(questionId: string, q: GeneratedQuestion): Promise<Result<true>> {
  const db = getDb();
  const upd = await db.from('questions').update({
    prompt: q.prompt, options: q.type === 'mcq' ? q.options : null, skill: q.skill, difficulty: q.difficulty,
    max_score: q.max_score, ai_generated: true, edited_by_recruiter: false,
  }).eq('id', questionId);
  if (upd.error) return err('db_error', "Couldn't save the new question.", upd.error.message);
  const key = await db.from('question_keys').upsert(keyRow(q, questionId));
  if (key.error) return err('db_error', "Couldn't save the new answer key.", key.error.message);
  return ok(true);
}

/** Applies a recruiter edit. The question keeps its type; only fields that belong to it are written. */
export async function patchQuestion(questionId: string, type: 'mcq' | 'short', patch: QuestionPatch): Promise<Result<true>> {
  const db = getDb();
  const q: Record<string, unknown> = { edited_by_recruiter: true };
  for (const k of ['prompt', 'skill', 'difficulty', 'max_score'] as const) if (patch[k] !== undefined) q[k] = patch[k];
  if (type === 'mcq' && patch.options !== undefined) q.options = patch.options;
  const upd = await db.from('questions').update(q).eq('id', questionId);
  if (upd.error) return err('db_error', "Couldn't save the change.", upd.error.message);

  const key: Record<string, unknown> = {};
  if (type === 'mcq') {
    if (patch.correct_option !== undefined) key.correct_option = patch.correct_option;
    if (patch.explanation !== undefined) key.explanation = patch.explanation;
  } else if (patch.rubric !== undefined) key.rubric = patch.rubric;
  if (Object.keys(key).length > 0) {
    const k = await db.from('question_keys').update(key).eq('question_id', questionId);
    if (k.error) return err('db_error', "Couldn't save the answer key.", k.error.message);
  }
  return ok(true);
}

/** Deletes a question and renumbers the rest. Refuses to go below the minimum. */
export async function deleteQuestion(assessmentId: string, questionId: string): Promise<Result<true>> {
  const db = getDb();
  const all = await db.from('questions').select('id, position').eq('assessment_id', assessmentId).order('position');
  if (all.error) return err('db_error', "Couldn't delete the question.", all.error.message);
  const rows = all.data as { id: string; position: number }[];
  if (rows.length <= MIN_QUESTIONS) return err('too_few_questions', `An assessment needs at least ${MIN_QUESTIONS} questions.`);
  const del = await db.from('questions').delete().eq('id', questionId);
  if (del.error) return err('db_error', "Couldn't delete the question.", del.error.message);
  const rest = rows.filter((r) => r.id !== questionId);
  for (const [i, r] of rest.entries()) {
    if (r.position !== i) await db.from('questions').update({ position: i }).eq('id', r.id);
  }
  return ok(true);
}

export async function updateAssessment(assessmentId: string, patch: { title?: string; duration_minutes?: number; instructions?: string }): Promise<Result<true>> {
  const { error } = await getDb().from('assessments').update(patch).eq('id', assessmentId);
  if (error) return err('db_error', "Couldn't save the change.", error.message);
  return ok(true);
}
