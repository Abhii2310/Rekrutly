import 'server-only';
import { CANDIDATE_QUESTION_COLUMNS } from '@/lib/db/candidate-columns';
import { getDb } from '@/lib/db/server';
import { err, ok, type Result } from '@/lib/result';

export type CandidateQuestion = {
  id: string; position: number; type: 'mcq' | 'short'; prompt: string; options: string[] | null; max_score: number; skill: string;
};

/** Candidate-safe questions for an assessment. Selects explicit columns and never joins question_keys. */
export async function getQuestionsForCandidate(assessmentId: string): Promise<Result<CandidateQuestion[]>> {
  const { data, error } = await getDb().from('questions').select(CANDIDATE_QUESTION_COLUMNS).eq('assessment_id', assessmentId).order('position');
  if (error) return err('db_error', 'Could not load the questions.', error.message);
  return ok(data as unknown as CandidateQuestion[]);
}
