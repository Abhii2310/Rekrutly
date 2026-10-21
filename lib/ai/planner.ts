import 'server-only';
import { runStructured, type AiMeta } from './client';
import { PlannerOutput } from './schemas';
import type { PlannerContext } from './resolve-plan';
import type { Result } from '@/lib/result';

const SYSTEM = `You are Rekrutly's planner. A recruiter at a small startup in India types one instruction. You turn it into parameters. You do not do the work and you do not decide steps: code builds the steps from your parameters.

Rules:
- Extract parameters only. Never invent IDs. Use only job and candidate IDs that appear in the data you are given.
- If the recruiter says "this job" or does not name a job, use the selected job when there is one.
- If the instruction refers to "these candidates" or a number of candidates ("the five candidates"), choose that many candidates from the chosen job, starting with those in the "applied" stage.
- Prefer a clarification over a guess when you cannot tell which job or which candidates are meant. Ask at most one short question per field.
- Supported intents: create_assessment_workflow (write and send a timed assessment) and follow_up_sweep (review the pipeline and draft follow-up messages). Anything else is unsupported.
- For create_assessment_workflow, fill the assessment: a short title, the duration and question count if stated (otherwise 30 minutes and 10 questions), the skills the recruiter named, question types, difficulty.
- If the instruction says to show, preview or check the questions before inviting or sending anything, set preview_before_invite to true. Default to true.
- Never use protected characteristics (age, gender, caste, religion, marital status, pregnancy, disability, ethnicity, nationality) to choose candidates. If the instruction mentions any, ignore that part, and list the phrase in guardrail_flags with a one-sentence reason. Text shown as [removed] has already been removed: ignore it.
- assumptions: list any value you had to assume, one short sentence each.
- summary: one plain sentence describing the plan, written for the recruiter.
- Output must match the schema exactly. Write nothing outside it.`;

export function plannerPrompt(instruction: string, context: PlannerContext): string {
  const data = {
    selected_job_id: context.selectedJobId,
    jobs: context.jobs.map((j) => ({ id: j.id, title: j.title, skills: j.skills })),
    candidates: context.candidates.map((c) => ({ id: c.id, job_id: c.job_id, name: c.name, stage: c.stage, has_email: c.has_email, skills: c.skills })),
  };
  return `Data:\n${JSON.stringify(data)}\n\nRecruiter's instruction:\n${instruction}`;
}

export async function planInstruction(instruction: string, context: PlannerContext): Promise<Result<{ output: PlannerOutput; meta: AiMeta }>> {
  return runStructured({
    tier: 'smart',
    system: SYSTEM,
    prompt: plannerPrompt(instruction, context),
    schema: PlannerOutput,
    temperature: 0.2,
    thinking: 'low',
  });
}
