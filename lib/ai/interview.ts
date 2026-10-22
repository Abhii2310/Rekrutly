import 'server-only';
import { z } from 'zod';
import { verifiedQuotes } from '@/lib/ats/rules';
import { MAIN_QUESTIONS, type InterviewSummary, type PlanQuestion } from '@/lib/ai-interview/rules';
import { err, ok, type Result } from '@/lib/result';
import { runStructured, type AiMeta } from './client';

const FAIR = `Judge only skills, projects, work and what was said. Ignore and never mention a person's name, gender, age, nationality, religion, caste, marital status, health, accent, photo or any other personal characteristic. Never say "best", "top", "recommend" or anything that ranks people or makes a hiring decision. Do not invent facts.`;

// ---- Planning: the questions for this person ----

const PlanOut = z.object({ questions: z.array(z.object({ question: z.string(), topic: z.string(), basis: z.enum(['resume', 'assessment', 'role']) })) });

const PLAN_SYSTEM = `You are a friendly, professional interviewer at a small startup. You prepare the questions for one candidate's short spoken interview, held right after their online assessment.

Rules:
- Write exactly ${MAIN_QUESTIONS} questions, in a natural speaking voice. Each is one or two short sentences, under 35 words, with no code, lists or jargon-heavy setup. They will be read aloud.
- Question 1 is a warm opener about a real project or experience from the resume (basis "resume"). If there is no resume, ask about their closest relevant experience (basis "role").
- At least one question must dig into the skill where the assessment showed the weakest result (basis "assessment"), asking how they would approach it or where they have used it. Be kind: never mention the score or that they did badly.
- Include one question about a challenge or a decision they made (basis "role" or "resume").
- No trivia, no trick questions, no yes/no questions. ${FAIR}
- "topic" is a short label such as the skill or "Experience". Output must match the schema exactly.`;

export type PlanInput = { jobTitle: string; jobDescription: string; skills: string[]; weakSkills: string[]; resume: string | null; assessmentLines: string[] };

export async function planInterview(input: PlanInput): Promise<Result<{ plan: PlanQuestion[]; meta: AiMeta }>> {
  const prompt = [
    `Role: ${input.jobTitle}`,
    `What the role involves: ${input.jobDescription.slice(0, 1000)}`,
    `Skills the role needs: ${input.skills.join(', ')}`,
    `Weakest areas in their assessment (be gentle about these): ${input.weakSkills.join(', ') || 'none noted'}`,
    input.assessmentLines.length ? `Assessment evidence:\n${input.assessmentLines.slice(0, 12).join('\n')}` : 'No assessment evidence available.',
    input.resume ? `Resume text (contact details removed):\n${input.resume}` : 'No resume was uploaded.',
  ].join('\n\n');
  const res = await runStructured({ tier: 'fast', system: PLAN_SYSTEM, prompt, schema: PlanOut, temperature: 0.5, thinking: 'low', timeoutMs: 25_000 });
  if (!res.ok) return err(res.error.code, res.error.message);
  const questions = res.data.output.questions.map((q) => ({ question: q.question.trim().slice(0, 300), topic: q.topic.trim().slice(0, 40) || 'Experience', basis: q.basis })).filter((q) => q.question.length >= 12);
  if (questions.length < 3) return err('invalid_output', 'The AI wrote too few questions.');
  return ok({ plan: questions.slice(0, MAIN_QUESTIONS), meta: res.data.meta });
}

// ---- Follow-up: one short question that digs into the answer ----

const FollowOut = z.object({ followup: z.string().nullable() });

const FOLLOW_SYSTEM = `You are a friendly interviewer. Given a question and the candidate's spoken answer, write ONE short follow-up that digs into something specific they said (their own part, a decision, a trade-off, a result, or an example). It is read aloud: one sentence, under 25 words, plain and warm. If the answer is already complete, or there is nothing specific to dig into, return null. Never criticise, never reveal any score, never ask about personal characteristics. ${FAIR}`;

export async function followUp(question: string, answer: string): Promise<string | null> {
  const res = await runStructured({ tier: 'fast', system: FOLLOW_SYSTEM, prompt: `Question: ${question}\n\nAnswer: ${answer.slice(0, 1500)}`, schema: FollowOut, temperature: 0.4, thinking: 'minimal', timeoutMs: 9_000 });
  if (!res.ok) return null;
  const t = res.data.output.followup?.trim() ?? '';
  return t.length >= 8 && t.length <= 300 ? t : null;
}

// ---- Summary: evidence notes for the recruiter ----

const SumOut = z.object({
  overview: z.string(),
  observations: z.array(z.object({ area: z.string(), note: z.string(), quote: z.string() })),
  probes: z.array(z.string()),
});

const SUM_SYSTEM = `You write evidence notes about one candidate's AI interview for a recruiter. The recruiter decides; you describe only what was said.

Rules:
- overview: two or three plain sentences about what the candidate described and how clearly.
- observations: at most 5. "area" is a short label (a skill or topic). "note" is one plain sentence about what they showed. "quote" must be copied exactly, word for word, from the candidate's answers (8 to 160 characters). Do not paraphrase it.
- probes: 2 to 4 specific questions a person could ask in a live interview, based on things that were vague or not shown.
- No score, no rating, no "strong" or "weak" verdict, no ranking, and no recommendation to hire or reject. ${FAIR}
- Output must match the schema exactly.`;

export async function summarizeInterview(input: { jobTitle: string; transcript: string; candidateAnswers: string; answered: number; skipped: number }): Promise<Result<{ summary: InterviewSummary; meta: AiMeta }>> {
  const res = await runStructured({ tier: 'fast', system: SUM_SYSTEM, prompt: `Role: ${input.jobTitle}\n\nTranscript:\n${input.transcript.slice(0, 9000)}`, schema: SumOut, temperature: 0.3, thinking: 'low', timeoutMs: 35_000 });
  if (!res.ok) return err(res.error.code, res.error.message);
  const o = res.data.output;
  const observations = verifiedQuotes(input.candidateAnswers, o.observations.slice(0, 5).map((x) => ({ area: x.area.trim().slice(0, 40), note: x.note.trim().slice(0, 240), quote: x.quote.trim().slice(0, 200) })));
  return ok({
    summary: { overview: o.overview.trim().slice(0, 600), observations, probes: o.probes.slice(0, 4).map((p) => p.trim().slice(0, 240)), answered: input.answered, skipped: input.skipped, aiModel: `${res.data.meta.provider}/${res.data.meta.model}` },
    meta: res.data.meta,
  });
}
