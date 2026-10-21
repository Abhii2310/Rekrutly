import 'server-only';
import { z } from 'zod';
import { err, ok, type Result } from '@/lib/result';
import { checkReport } from '@/lib/scoring/report-rules';
import type { Evidence } from '@/lib/scoring/evidence';
import { runStructured, type AiMeta } from './client';
import { CandidateReport } from './schemas';

// Gemini rejects min/max on arrays of nested objects (HTTP 400): the model-facing schema is unbounded and the
// real limits (CandidateReport) are applied in code after the model answers.
const ModelReport = z.object({
  summary: z.string(),
  strengths: z.array(z.object({ skill: z.string(), evidence: z.string() })),
  gaps: z.array(z.object({ skill: z.string(), evidence: z.string() })),
  interview_questions: z.array(z.object({ skill: z.string(), question: z.string(), what_good_looks_like: z.string() })),
  missing_evidence: z.array(z.string()),
});

const SYSTEM = `You write an evidence-based note about one candidate's assessment for a recruiter at a small startup. The recruiter decides; you only describe what the evidence shows.

Rules:
- Use only the evidence lines you are given. Do not invent facts, and do not mention anything about the person beyond these results. There is no name, age, gender or background in the data and you must not guess any.
- Never say "best", "top", "strongest candidate", "recommend" or anything that ranks people or makes a hiring decision.
- summary: two or three plain sentences about what the results show.
- strengths and gaps: at most 4 each. "skill" must be one of the listed skills. "evidence" must be copied from, or be a short exact piece of, the evidence lines.
- interview_questions: 3 to 6 questions aimed at the gaps and at skills with thin evidence. Each has a skill, a question, and what_good_looks_like (one or two sentences).
- missing_evidence: up to 4 short notes on what the assessment could not show (for example a skill with only one question, or questions that were not answered). Only mention skills from the list.
- Output must match the schema exactly.`;

export type ReportInput = { jobTitle: string; skills: string[]; evidence: Evidence };

export async function generateReport(input: ReportInput): Promise<Result<{ report: CandidateReport; meta: AiMeta }>> {
  const prompt = [
    `Role: ${input.jobTitle}`,
    `Skills (use exactly these names): ${input.skills.join(', ')}`,
    `Evidence lines:\n${input.evidence.lines.map((l, i) => `${i + 1}. ${l}`).join('\n')}`,
  ].join('\n\n');
  const res = await runStructured({ tier: 'smart', system: SYSTEM, prompt, schema: ModelReport, temperature: 0.3, thinking: 'low', timeoutMs: 40_000 });
  if (!res.ok) return err(res.error.code, res.error.message);

  const raw = res.data.output;
  const checked = checkReport(
    {
      summary: raw.summary.slice(0, 500),
      strengths: raw.strengths.slice(0, 4).map((x) => ({ ...x, evidence: x.evidence.slice(0, 300) })),
      gaps: raw.gaps.slice(0, 4).map((x) => ({ ...x, evidence: x.evidence.slice(0, 300) })),
      interview_questions: raw.interview_questions.slice(0, 6).map((q) => ({ ...q, question: q.question.slice(0, 300), what_good_looks_like: q.what_good_looks_like.slice(0, 300) })),
      missing_evidence: raw.missing_evidence.slice(0, 4).map((m) => m.slice(0, 200)),
    },
    { skills: input.skills, evidenceBySkill: input.evidence.bySkill, weakestSkill: input.evidence.weakestSkill },
  );
  const parsed = CandidateReport.safeParse(checked);
  if (!parsed.success) return err('invalid_output', 'The AI report was missing required parts.');
  return ok({ report: parsed.data, meta: res.data.meta });
}
