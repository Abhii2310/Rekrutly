import 'server-only';
import { z } from 'zod';
import { err, ok, type Result } from '@/lib/result';
import { runStructured, type AiMeta } from './client';
import { balanceTypes, leastCoveredFirst, pointsFor, postValidate, skillQuotas, splitTypes, type Difficulty, type QuestionType } from './question-rules';
import { GeneratedQuestion } from './schemas';

// Gemini rejects minItems/maxItems on arrays of these nested objects (HTTP 400), so the model-facing
// schema leaves the array unbounded and postValidate enforces the exact count in code.
const Batch = z.object({ questions: z.array(GeneratedQuestion) });
const One = z.object({ question: GeneratedQuestion });

const SYSTEM = `You write technical assessment questions for a small startup hiring a developer in India. A senior engineer will read them, so quality matters more than quantity.

Rules:
- Write practical questions a working developer would recognise. Short code snippets inside the prompt are welcome: put code in fenced blocks (three backticks) and keep it under 15 lines.
- Spread the questions across the requested skills using the quotas you are given. The "skill" field must be exactly one of the requested skills.
- Multiple-choice: exactly four options, exactly one defensibly correct option, three plausible distractors. No "all of the above" and no trick wording.
- Short answer: answerable in 3 to 6 sentences within the time limit. Give a rubric of 2 to 5 checkable points (weights 1 to 5) and a model answer.
- No trivia, no brand-name memorisation, no trick questions. Nothing about personal characteristics, background or culture.
- Match the requested number of multiple-choice and short-answer questions exactly, and the difficulty plan. Spread short-answer questions across different skills where you can.
- Do not repeat or lightly reword any question in the "Avoid" list.
- Output must match the schema exactly. Write nothing outside it.`;

export type QuestionJob = { title: string; description: string; skills: string[] };

export type GenerateInput = {
  job: QuestionJob;
  skills: string[];
  count: number;
  durationMinutes: number;
  types: QuestionType[];
  difficulty: Difficulty;
  seed: string;
};

export type GeneratedSet = { questions: GeneratedQuestion[]; warnings: string[]; meta: AiMeta };

function difficultyPlan(difficulty: Difficulty, count: number): string {
  if (difficulty !== 'mixed') return `All ${difficulty}.`;
  const easy = Math.round(count * 0.3);
  const hard = Math.round(count * 0.3);
  return `About ${easy} easy, ${count - easy - hard} medium and ${hard} hard.`;
}

function brief(input: GenerateInput, mix: { mcq: number; short: number }, skillOrder: readonly string[], avoid: string[]): string {
  const count = mix.mcq + mix.short;
  const quotas = skillQuotas(count, skillOrder).filter((q) => q.count > 0).map((q) => `${q.skill}: ${q.count}`).join(', ');
  return [
    `Role: ${input.job.title}`,
    input.job.description ? `About the role: ${input.job.description}` : '',
    `Time limit for the whole assessment: ${input.durationMinutes} minutes.`,
    `Write exactly ${count} questions: ${mix.mcq} multiple-choice and ${mix.short} short-answer.`,
    `Skill quotas (use these skill names exactly): ${quotas}.`,
    `Difficulty: ${difficultyPlan(input.difficulty, count)}`,
    avoid.length ? `Avoid (already written):\n${avoid.map((p) => `- ${p.slice(0, 160)}`).join('\n')}` : '',
  ].filter(Boolean).join('\n');
}

async function callBatch(input: GenerateInput, mix: { mcq: number; short: number }, skillOrder: readonly string[], avoid: string[]) {
  return runStructured({
    tier: 'smart', system: SYSTEM, prompt: brief(input, mix, skillOrder, avoid), schema: Batch,
    temperature: 0.6, thinking: 'low', timeoutMs: 35_000,
  });
}

/**
 * Writes the whole set, then tops up once if the count or the multiple-choice / short-answer split
 * is off, then applies the pure post-validation (exact count, allowed skills, points, answer spread).
 */
export async function generateQuestionSet(input: GenerateInput): Promise<Result<GeneratedSet>> {
  const want = splitTypes(input.count, input.types);
  const first = await callBatch(input, want, input.skills, []);
  if (!first.ok) return first;
  let meta = first.data.meta;

  // Normalise without trimming, so the type balance can decide what to keep.
  const loose = { count: 99, skills: input.skills, durationMinutes: input.durationMinutes, seed: input.seed, types: input.types };
  const cleaned = postValidate(first.data.output.questions, loose).questions;
  const { kept, need } = balanceTypes(cleaned, want);
  let pool = kept;

  if (need.mcq + need.short > 0) {
    const more = await callBatch(input, need, leastCoveredFirst(kept, input.skills), kept.map((q) => q.prompt));
    if (more.ok) {
      pool = [...kept, ...postValidate(more.data.output.questions, loose).questions];
      pool = balanceTypes(pool, want).kept;
      meta = more.data.meta;
    }
  }

  const checked = postValidate(pool, { count: input.count, skills: input.skills, durationMinutes: input.durationMinutes, seed: input.seed, types: input.types });
  const warnings = [...checked.warnings];
  if (checked.shortfall > 0) warnings.push(`Wrote ${checked.questions.length} of ${input.count} questions. Add the rest by hand or regenerate.`);
  if (checked.questions.length < 3) return err('invalid_output', 'The AI returned too few usable questions.');
  return ok({ questions: checked.questions, warnings, meta });
}

export type RegenerateInput = {
  job: QuestionJob;
  skill: string;
  type: QuestionType;
  difficulty: 'easy' | 'medium' | 'hard';
  durationMinutes: number;
  avoid: string[];
  seed: string;
};

/** One replacement question with the same type, skill and difficulty. */
export async function regenerateQuestion(input: RegenerateInput): Promise<Result<{ question: GeneratedQuestion; meta: AiMeta }>> {
  const prompt = [
    `Role: ${input.job.title}`,
    `Write exactly 1 ${input.type === 'mcq' ? 'multiple-choice' : 'short-answer'} question.`,
    `Skill (use exactly): ${input.skill}`,
    `Difficulty: ${input.difficulty}`,
    `Time limit for the whole assessment: ${input.durationMinutes} minutes.`,
    `Avoid (already in the assessment, do not repeat or reword):\n${input.avoid.map((p) => `- ${p.slice(0, 160)}`).join('\n')}`,
  ].join('\n');
  // One question is a small job: the fast model is plenty and is less rate-limited than the smart one.
  const res = await runStructured({ tier: 'fast', system: SYSTEM, prompt, schema: One, temperature: 0.7, thinking: 'low', timeoutMs: 25_000 });
  if (!res.ok) return res;
  const checked = postValidate([res.data.output.question], {
    count: 1, skills: [input.skill], durationMinutes: 999, seed: input.seed, types: [input.type],
  });
  const q = checked.questions[0];
  if (!q) return err('invalid_output', 'The AI returned a question that did not fit.');
  return ok({ question: { ...q, difficulty: input.difficulty, max_score: pointsFor(q.type, input.difficulty) }, meta: res.data.meta });
}
