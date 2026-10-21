import { z } from 'zod';

const Options = z.array(z.string().trim().min(1, 'Fill in every option.').max(300, 'Options can be up to 300 characters.')).length(4, 'Give exactly four options.');
const Rubric = z.object({
  criteria: z.array(z.object({ point: z.string().trim().min(1, 'Fill in every rubric point.').max(200), weight: z.number().min(1, 'Weights are 1 to 5.').max(5, 'Weights are 1 to 5.') })).min(2, 'Add at least two rubric points.').max(5, 'Use at most five rubric points.'),
  model_answer: z.string().trim().max(1200, 'The model answer is too long.'),
});

const common = {
  prompt: z.string().trim().min(10, 'The question needs at least 10 characters.').max(2000),
  skill: z.string().trim().min(1, 'Add a skill.').max(60),
  difficulty: z.enum(['easy', 'medium', 'hard']),
  max_score: z.number().min(1, 'Points are 1 to 20.').max(20, 'Points are 1 to 20.'),
};

/** A whole question as the recruiter submits it (add) or as stored (edit merges into the existing one). */
export const QuestionInput = z.discriminatedUnion('type', [
  z.object({ type: z.literal('mcq'), ...common, options: Options, correct_option: z.number().int().min(0).max(3), explanation: z.string().trim().max(400).optional() }),
  z.object({ type: z.literal('short'), ...common, rubric: Rubric }),
]);
export type QuestionInput = z.infer<typeof QuestionInput>;

/** Edits keep the question's type, so the patch only carries fields that belong to it. */
export const QuestionPatch = z.object({
  prompt: common.prompt.optional(),
  skill: common.skill.optional(),
  difficulty: common.difficulty.optional(),
  max_score: common.max_score.optional(),
  options: Options.optional(),
  correct_option: z.number().int().min(0).max(3).optional(),
  explanation: z.string().trim().max(400).optional(),
  rubric: Rubric.optional(),
}).refine((v) => Object.keys(v).length > 0, { message: 'Nothing to change.' });
export type QuestionPatch = z.infer<typeof QuestionPatch>;

export const AssessmentPatch = z.object({
  title: z.string().trim().min(3, 'The title needs at least 3 characters.').max(120).optional(),
  duration_minutes: z.number().int().min(5).max(180).optional(),
  instructions: z.string().trim().max(2000).optional(),
}).refine((v) => Object.keys(v).length > 0, { message: 'Nothing to change.' });
