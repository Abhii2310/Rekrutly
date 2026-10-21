import 'server-only';
import { z } from 'zod';
import { err, ok, type Result } from '@/lib/result';
import { runStructured, type AiMeta } from './client';
import { checkDraft, LANGUAGE_NAMES, LANGUAGE_SCRIPTS, type Language } from './followup-rules';
import type { FollowUpDraft } from './schemas';

// No length limits here: strict providers answer HTTP 400 when a field is slightly over. checkDraft enforces them.
const ModelDraft = z.object({ subject: z.string(), body: z.string(), whatsapp_text: z.string() });

const SYSTEM = `You write a short follow-up message from a small startup's hiring team to one job candidate who has not started their online assessment.

Rules:
- Warm, calm and professional. Never pressure, never threaten, never hint at consequences or other candidates.
- Do not mention any other candidate, any score, or anything about the candidate beyond their first name.
- Say the role, that the test takes about the stated number of minutes, and the date the link works until if one is given.
- Do not write a link or a URL. It is added afterwards.
- Sign off as "the hiring team" (translated naturally in the chosen language). Do not invent a company name or a person's name.
- "body" is a short email: a greeting, two or three sentences, a sign-off. "whatsapp_text" is a shorter version for WhatsApp: two sentences at most, no subject, no sign-off line needed beyond a short thanks.
- Write in the requested language and script. Write the candidate's first name exactly as given, in the Latin alphabet.
- Output must match the schema exactly.`;

export type DraftInput = {
  firstName: string;
  role: string;
  durationMinutes: number;
  /** Human date such as "28 Oct", or null when the link has no deadline. */
  validUntil: string | null;
  language: Language;
  /** Added by code after the model answers. Null when the link can no longer be used. */
  link: string | null;
};

/** Fast-model draft in English, Hindi or Kannada. Never sends anything. One retry if the script is wrong. */
export async function draftFollowUp(input: DraftInput): Promise<Result<{ draft: FollowUpDraft; meta: AiMeta }>> {
  const prompt = (extra: string): string => [
    `Language: ${LANGUAGE_NAMES[input.language]}, written in ${LANGUAGE_SCRIPTS[input.language]}.`,
    `Candidate's first name: ${input.firstName}`,
    `Role: ${input.role}`,
    `The test takes about ${input.durationMinutes} minutes.`,
    input.validUntil ? `The link works until ${input.validUntil}.` : 'There is no stated deadline.',
    extra,
  ].filter(Boolean).join('\n');

  let lastReason = 'The message could not be written.';
  for (const extra of ['', `Write every word except the first name in ${LANGUAGE_NAMES[input.language]} using ${LANGUAGE_SCRIPTS[input.language]}. Do not write it in English.`]) {
    const res = await runStructured({ tier: 'fast', system: SYSTEM, prompt: prompt(extra), schema: ModelDraft, temperature: 0.5, thinking: 'low', timeoutMs: 30_000 });
    if (!res.ok) return err(res.error.code, res.error.message);
    const checked = checkDraft(input.language, res.data.output, input.link);
    if (checked.ok) return ok({ draft: checked.draft, meta: res.data.meta });
    lastReason = checked.reason;
    if (input.language === 'en') break;
  }
  return err('invalid_output', lastReason);
}
