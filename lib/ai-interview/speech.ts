/** Pure helpers that make the interviewer easy to hear and read: clean text, spoken text and the best voice. */

const DASHES = /[‐‑‒–—―−]/g;

/** Plain punctuation for the screen and the voice: curly quotes, long dashes and non-breaking hyphens trip up speech engines and fonts. */
export function cleanQuestion(text: string): string {
  return text
    .replace(/[‘’‛′]/g, "'")
    .replace(/[“”„″]/g, '"')
    .replace(/\s*[–—―]\s*/g, ', ')
    .replace(DASHES, '-')
    .replace(/…/g, '...')
    .replace(/[  ​‌‍﻿]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const SPOKEN: [RegExp, string][] = [
  [/\bB2B\b/g, 'B to B'], [/\bB2C\b/g, 'B to C'], [/\bUX\b/g, 'U X'], [/\bUI\b/g, 'U I'], [/\bAPIs\b/g, 'A P Is'], [/\bAPI\b/g, 'A P I'],
  [/\bSQL\b/g, 'sequel'], [/\bKPIs\b/g, 'K P Is'], [/\bKPI\b/g, 'K P I'], [/\bCSS\b/g, 'C S S'], [/\bHTML\b/g, 'H T M L'], [/\bQA\b/g, 'Q A'],
  [/\be\.g\./gi, 'for example'], [/\bi\.e\./gi, 'that is'], [/\bvs\.?(?=\s)/gi, 'versus'], [/&/g, ' and '], [/\//g, ' or '],
];

/** What the voice should say: the clean text with short forms spelled out, and hyphenated words read as two words. */
export function spokenText(text: string): string {
  let t = cleanQuestion(text).replace(/(\w)-(\w)/g, '$1 $2');
  for (const [re, to] of SPOKEN) t = t.replace(re, to);
  return t.replace(/\s+/g, ' ').trim();
}

/** The sentences of a line, so the one being spoken can be highlighted. */
export function splitSentences(text: string): string[] {
  return cleanQuestion(text).match(/[^.!?]+[.!?]*/g)?.map((s) => s.trim()).filter(Boolean) ?? [cleanQuestion(text)];
}

const NATURAL = /natural|neural|online|premium|enhanced/i;
const GOOD_NAMES = /google (uk|us|india)? ?english|samantha|karen|moira|tessa|serena|veena|aria|jenny|libby|sonia|zira|hazel|susan|catherine|allison|ava|joanna|kendra|salli|raveena|heera|neerja/i;
const FEMALE = /female|samantha|karen|moira|tessa|serena|veena|aria|jenny|libby|sonia|zira|hazel|susan|catherine|allison|ava|joanna|kendra|salli|raveena|heera|neerja|fiona|victoria|amelie/i;
const MALE = /\bmale\b|alex|fred|daniel|david|mark|george|guy|ryan|thomas|oliver|rishi|ravi|james|arthur/i;

/** Lower is better: natural-sounding, warm, English, and preferably a gentle female voice. Pure, so it can be tested. */
export function rankVoice(name: string, lang: string): number {
  const l = lang.replace('_', '-').toLowerCase();
  if (!l.startsWith('en')) return 99;
  let score = l === 'en-in' ? 2 : l === 'en-gb' ? 3 : l === 'en-us' ? 4 : l === 'en-au' ? 5 : 6;
  if (NATURAL.test(name)) score -= 6;
  else if (GOOD_NAMES.test(name)) score -= 3;
  if (FEMALE.test(name) && !/\bmale\b/i.test(name.replace(/female/i, ''))) score -= 2;
  if (MALE.test(name.replace(/female/gi, ''))) score += 3;
  if (/compact|espeak|robot|novelty|whisper|bad news|bells|boing|bubbles|cellos|deranged|good news|hysterical|organ|trinoids|zarvox|albert|junior|kathy|ralph|superstar/i.test(name)) score += 20;
  return score;
}

export function bestVoiceIndex(voices: readonly { name: string; lang: string }[]): number {
  let best = -1;
  let bestScore = 98;
  voices.forEach((v, i) => { const s = rankVoice(v.name, v.lang); if (s < bestScore) { bestScore = s; best = i; } });
  return best;
}
