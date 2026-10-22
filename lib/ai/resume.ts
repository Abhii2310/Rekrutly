import 'server-only';
import { z } from 'zod';
import { err, ok, type Result } from '@/lib/result';
import { runStructured, type AiMeta } from './client';

const ModelOut = z.object({
  relevance: z.number(),
  summary: z.string(),
  strengths: z.array(z.object({ point: z.string(), quote: z.string() })),
  gaps: z.array(z.string()),
});

const SYSTEM = `You read one resume for a recruiter at a small startup and describe how well the experience fits one role. The recruiter decides; you only describe what the resume shows.

Rules:
- Judge only skills, tools, projects and work experience. Ignore the person's name, gender, age, nationality, religion, caste, marital status, health, photo, address and any other personal characteristic, and never mention them. Do not favour or penalise a school or employer by prestige.
- relevance: a number from 0 to 10 for how closely the experience matches the role's work. 0 means unrelated, 10 means a direct match with clear evidence.
- summary: two plain sentences about how the experience relates to the role.
- strengths: at most 4. "point" is a short plain phrase. "quote" must be copied exactly, word for word, from the resume (at least 8 characters, under 160). Do not paraphrase the quote.
- gaps: at most 4 short phrases naming what the role needs that the resume does not show. Say "not shown", never "does not have".
- Never say "best", "top", "strong hire", "recommend" or anything that ranks people or decides. Do not invent facts.
- Output must match the schema exactly.`;

export type ResumeRead = { relevance: number; summary: string; strengths: { point: string; quote: string }[]; gaps: string[] };

export async function readResume(input: { jobTitle: string; jobDescription: string; skills: string[]; resume: string }): Promise<Result<{ read: ResumeRead; meta: AiMeta }>> {
  const prompt = [
    `Role: ${input.jobTitle}`,
    `What the role involves: ${input.jobDescription.slice(0, 1200)}`,
    `Skills the role needs: ${input.skills.join(', ')}`,
    `Resume text (contact details removed):\n${input.resume}`,
  ].join('\n\n');
  const res = await runStructured({ tier: 'fast', system: SYSTEM, prompt, schema: ModelOut, temperature: 0.2, thinking: 'low', timeoutMs: 35_000 });
  if (!res.ok) return err(res.error.code, res.error.message);
  const o = res.data.output;
  return ok({
    read: {
      relevance: Math.min(1, Math.max(0, o.relevance / 10)),
      summary: o.summary.trim().slice(0, 400),
      strengths: o.strengths.slice(0, 4).map((s) => ({ point: s.point.trim().slice(0, 120), quote: s.quote.trim().slice(0, 200) })),
      gaps: o.gaps.slice(0, 4).map((g) => g.trim().slice(0, 120)),
    },
    meta: res.data.meta,
  });
}
