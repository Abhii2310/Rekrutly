import type { FollowUpDraft } from './schemas';

export type Language = FollowUpDraft['language'];
export const LANGUAGE_NAMES: Record<Language, string> = { en: 'English', hi: 'Hindi', kn: 'Kannada' };
export const LANGUAGE_SCRIPTS: Record<Language, string> = { en: 'the Latin alphabet', hi: 'Devanagari script', kn: 'Kannada script' };
export const LINK_LABEL: Record<Language, string> = { en: 'Your link', hi: 'आपका लिंक', kn: 'ನಿಮ್ಮ ಲಿಂಕ್' };

const RANGES: Record<Language, RegExp> = {
  en: /[A-Za-z]/g,
  hi: /[ऀ-ॿ]/g,
  kn: /[ಀ-೿]/g,
};

/** Share of the letters in `text` that are in the language's own script, 0 to 1. */
export function scriptShare(text: string, language: Language): number {
  const letters = text.match(/\p{L}/gu)?.length ?? 0;
  if (letters === 0) return 0;
  return (text.match(RANGES[language])?.length ?? 0) / letters;
}

export type RawDraft = { subject: string; body: string; whatsapp_text: string };

const clean = (s: string): string => s.replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();

/** Cuts at the last sentence end before `max` when possible, otherwise at a word. */
function cut(text: string, max: number): string {
  if (text.length <= max) return text;
  const head = text.slice(0, max);
  const end = Math.max(head.lastIndexOf('. '), head.lastIndexOf('।'), head.lastIndexOf('!'), head.lastIndexOf('?'));
  if (end > max * 0.5) return head.slice(0, end + 1).trim();
  return `${head.slice(0, head.lastIndexOf(' ') > 0 ? head.lastIndexOf(' ') : max).trim()}…`;
}

/**
 * Enforces the limits in code (the model-facing schema has none), checks the script, and adds the candidate link.
 * The link is added here, never by the model, so a token is never part of a prompt or a model answer.
 */
export function checkDraft(language: Language, raw: RawDraft, link: string | null): { ok: true; draft: FollowUpDraft } | { ok: false; reason: string } {
  const subject = cut(clean(raw.subject).replace(/\n/g, ' '), 120);
  const body = cut(clean(raw.body), 900);
  const wa = cut(clean(raw.whatsapp_text), 420);
  if (!body || !wa) return { ok: false, reason: 'The message was empty.' };
  if (language !== 'en') {
    // Names and the link stay in Latin letters, so the bar is a clear majority, not all of it.
    if (scriptShare(`${subject} ${body}`, language) < 0.6 || scriptShare(wa, language) < 0.6) {
      return { ok: false, reason: `The message was not written in ${LANGUAGE_NAMES[language]}.` };
    }
  }
  const add = link ? `\n\n${LINK_LABEL[language]}: ${link}` : '';
  return { ok: true, draft: { language, subject, body: `${body}${add}`, whatsapp_text: `${wa}${add}` } };
}
