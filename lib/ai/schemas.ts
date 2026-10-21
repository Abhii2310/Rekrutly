import { z } from 'zod';

export const PlannerOutput = z.object({
  intent: z.enum(['create_assessment_workflow', 'follow_up_sweep', 'unsupported']),
  job_id: z.string().uuid().nullable(),
  candidate_ids: z.array(z.string().uuid()).max(50),
  assessment: z
    .object({
      title: z.string().min(3).max(120),
      duration_minutes: z.number().int().min(5).max(180),
      question_count: z.number().int().min(3).max(20),
      skills: z.array(z.string().min(1).max(40)).min(1).max(8),
      question_types: z.array(z.enum(['mcq', 'short'])).min(1),
      difficulty: z.enum(['easy', 'medium', 'hard', 'mixed']),
    })
    .nullable(),
  preview_before_invite: z.boolean(),
  clarifications: z.array(z.object({ field: z.string(), question: z.string().max(200) })).max(3),
  guardrail_flags: z.array(z.object({ phrase: z.string(), reason: z.string().max(200) })),
  assumptions: z.array(z.string().max(160)).max(5),
  summary: z.string().max(280),
});
export type PlannerOutput = z.infer<typeof PlannerOutput>;

export const GeneratedQuestion = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('mcq'),
    prompt: z.string().min(10).max(1200),
    options: z.array(z.string().min(1).max(300)).length(4),
    correct_option: z.number().int().min(0).max(3),
    explanation: z.string().max(400),
    skill: z.string(),
    difficulty: z.enum(['easy', 'medium', 'hard']),
    max_score: z.number().min(1).max(5),
  }),
  z.object({
    type: z.literal('short'),
    prompt: z.string().min(10).max(1200),
    rubric: z.object({
      criteria: z.array(z.object({ point: z.string().max(200), weight: z.number().min(1).max(5) })).min(2).max(5),
      model_answer: z.string().max(1200),
    }),
    skill: z.string(),
    difficulty: z.enum(['easy', 'medium', 'hard']),
    max_score: z.number().min(2).max(10),
  }),
]);
export type GeneratedQuestion = z.infer<typeof GeneratedQuestion>;

export const QuestionSet = z.object({ questions: z.array(GeneratedQuestion).min(3).max(20) });
export type QuestionSet = z.infer<typeof QuestionSet>;

export const ShortAnswerGrade = z.object({
  score: z.number().min(0), // clamped to max_score in code
  matched_criteria: z.array(z.string()),
  missing_criteria: z.array(z.string()),
  evidence_quote: z.string().max(300), // must be an exact substring of the answer
  reasoning: z.string().max(400),
  confidence: z.enum(['low', 'medium', 'high']),
});
export type ShortAnswerGrade = z.infer<typeof ShortAnswerGrade>;

export const CandidateReport = z.object({
  summary: z.string().max(500),
  strengths: z.array(z.object({ skill: z.string(), evidence: z.string().max(300) })).max(4),
  gaps: z.array(z.object({ skill: z.string(), evidence: z.string().max(300) })).max(4),
  interview_questions: z
    .array(z.object({ skill: z.string(), question: z.string().max(300), what_good_looks_like: z.string().max(300) }))
    .min(3)
    .max(6),
  missing_evidence: z.array(z.string().max(200)).max(4),
});
export type CandidateReport = z.infer<typeof CandidateReport>;

export const FollowUpDraft = z.object({
  language: z.enum(['en', 'hi', 'kn']),
  subject: z.string().max(120),
  body: z.string().max(1200),
  whatsapp_text: z.string().max(600),
});
export type FollowUpDraft = z.infer<typeof FollowUpDraft>;
