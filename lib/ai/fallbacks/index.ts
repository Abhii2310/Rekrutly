import { PlannerOutput, QuestionSet } from '../schemas';
import planJson from './demo-plan.json';
import questionsJson from './demo-questions.json';

/** The saved planner output for the demo job, captured from a real run (npm run capture:fallback). Null if it no longer matches the schema. */
export function savedPlan(): PlannerOutput | null {
  const r = PlannerOutput.safeParse(planJson);
  return r.success ? r.data : null;
}

/** The saved question set and answer keys for the demo job. Null if it no longer matches the schema. */
export function savedQuestions(): QuestionSet | null {
  const r = QuestionSet.safeParse(questionsJson);
  return r.success ? r.data : null;
}
