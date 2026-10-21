import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { getScriptDb, loadEnv } from './db';
import { PlannerOutput, QuestionSet, type GeneratedQuestion } from '../lib/ai/schemas';
import { DEMO_CANDIDATE_IDS, DEMO_JOB_ID } from '../lib/demo/ids';

/**
 * npm run capture:fallback -- --run <id>
 * Saves a successful demo run's planner output and questions as the offline fallback (lib/ai/fallbacks/*.json).
 * Refuses runs that are not about the seeded job and candidates, so the fallback keeps working after every reset.
 */
async function main(): Promise<void> {
  const i = process.argv.indexOf('--run');
  const runId = i >= 0 ? process.argv[i + 1] : undefined;
  if (!runId) throw new Error('Pass the run: npm run capture:fallback -- --run <run id>');

  const db = getScriptDb(loadEnv());
  const run = await db.from('workflow_runs').select('id, intent, job_id, plan').eq('id', runId).maybeSingle();
  if (run.error) throw new Error(run.error.message);
  if (!run.data) throw new Error('That run does not exist.');
  const plan = run.data.plan as {
    summary: string; assumptions: string[]; candidates: { id: string }[];
    assessment: PlannerOutput['assessment']; job: { id: string } | null;
  };
  if (run.data.intent !== 'create_assessment_workflow') throw new Error('Only an assessment workflow can be saved.');
  if (run.data.job_id !== DEMO_JOB_ID) throw new Error('Refused: the run is not for the seeded Full-Stack Developer job, so the saved plan would break after a reset.');
  const ids = plan.candidates.map((c) => c.id);
  if (ids.length === 0 || ids.some((id) => !DEMO_CANDIDATE_IDS.includes(id))) {
    throw new Error('Refused: the run includes candidates that are not the five seeded Full-Stack Developer candidates.');
  }

  const planner = PlannerOutput.parse({
    intent: 'create_assessment_workflow', job_id: DEMO_JOB_ID, candidate_ids: ids, assessment: plan.assessment,
    preview_before_invite: true, clarifications: [], guardrail_flags: [], assumptions: plan.assumptions, summary: plan.summary,
  });

  const a = await db.from('assessments').select('id').eq('run_id', runId).maybeSingle();
  if (a.error || !a.data) throw new Error('The run has no questions yet. Write the questions first.');
  const qs = await db.from('questions').select('id, position, type, prompt, options, skill, difficulty, max_score').eq('assessment_id', a.data.id).order('position');
  if (qs.error) throw new Error(qs.error.message);
  const keys = await db.from('question_keys').select('question_id, correct_option, rubric, explanation').in('question_id', (qs.data ?? []).map((q) => q.id as string));
  if (keys.error) throw new Error(keys.error.message);
  const keyOf = new Map((keys.data ?? []).map((k) => [k.question_id as string, k]));

  const questions: GeneratedQuestion[] = (qs.data ?? []).map((q) => {
    const k = keyOf.get(q.id as string);
    if (!k) throw new Error('A question has no answer key.');
    const base = { prompt: q.prompt as string, skill: q.skill as string, difficulty: q.difficulty as 'easy' | 'medium' | 'hard', max_score: Number(q.max_score) };
    return q.type === 'mcq'
      ? { type: 'mcq', ...base, options: q.options as string[], correct_option: k.correct_option as number, explanation: (k.explanation as string | null) ?? '' }
      : { type: 'short', ...base, rubric: k.rubric as { criteria: { point: string; weight: number }[]; model_answer: string } };
  });
  const set = QuestionSet.parse({ questions });

  const dir = resolve(__dirname, '../lib/ai/fallbacks');
  writeFileSync(resolve(dir, 'demo-plan.json'), `${JSON.stringify(planner, null, 2)}\n`);
  writeFileSync(resolve(dir, 'demo-questions.json'), `${JSON.stringify(set, null, 2)}\n`);
  console.log(`Saved the plan and ${set.questions.length} questions to lib/ai/fallbacks/. Commit both files.`);
}

main().catch((e: unknown) => {
  console.error('Capture failed:', e instanceof Error ? e.message : e);
  process.exit(1);
});
