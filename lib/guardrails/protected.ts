export type GuardrailFlag = { phrase: string; reason: string; /** Set by the code check, for example "age". Model flags have none. */ category?: string };

type Rule = { category: string; reason: string; pattern: RegExp };

const REASON = (what: string): string =>
  `Rekrutly doesn't filter candidates by ${what} or other personal characteristics.`;

// Durations, counts and money after a number are NOT age ("under 30 minutes", "over 10 questions").
const NOT_A_UNIT =
  String.raw`(?!\s*(?:-|–)?\s*(?:minutes?|mins?|hours?|hrs?|days?|weeks?|months?|questions?|candidates?|people|applicants?|roles?|jobs?|points?|marks?|percent|%|lpa|lakhs?|k\b|seconds?|steps?|items?)\b)(?!\s+years?\s+(?:of\s+)?(?:work\s+|relevant\s+)?(?:experience|exp)\b)`;

const RULES: Rule[] = [
  {
    category: 'age',
    reason: REASON('age'),
    pattern: new RegExp(
      String.raw`\b(?:\d{1,2}\s*(?:years?|yrs?)[\s-]*old|years?[\s-]*old|aged?\b(?:\s+group)?|young(?:er)?|youth|elderly|(?:under|below|over|above|older\s+than|younger\s+than|less\s+than|more\s+than)\s+(?:1[89]|[2-6]\d)\b${NOT_A_UNIT})`,
      'gi',
    ),
  },
  { category: 'gender', reason: REASON('gender'), pattern: /\b(?:gender|males?|females?|men|women|man|woman|boys?|girls?)\b/gi },
  { category: 'marital status', reason: REASON('marital status'), pattern: /\b(?:married|unmarried|single\s+(?:men|women|candidates?)|marital)\b/gi },
  { category: 'pregnancy', reason: REASON('pregnancy'), pattern: /\b(?:pregnan(?:t|cy)|maternity)\b/gi },
  { category: 'religion or caste', reason: REASON('religion or caste'), pattern: /\b(?:religion|religious|hindus?|muslims?|christians?|sikhs?|jains?|buddhists?|caste|dalits?|brahmins?|obc|scheduled\s+caste)\b/gi },
  { category: 'disability', reason: REASON('disability'), pattern: /\b(?:disabilit(?:y|ies)|disabled|handicapped)\b/gi },
  { category: 'ethnicity or nationality', reason: REASON('ethnicity or nationality'), pattern: /\b(?:ethnicity|ethnic|nationality|race|racial)\b/gi },
];

/**
 * Runs on every instruction before the model is called. Returns the phrases that touch protected
 * characteristics so the plan can drop them and tell the recruiter why.
 */
export function checkInstruction(text: string): { flagged: GuardrailFlag[] } {
  const seen = new Set<string>();
  const flagged: GuardrailFlag[] = [];
  for (const { category, reason, pattern } of RULES) {
    for (const m of text.matchAll(pattern)) {
      const phrase = m[0].trim();
      const key = phrase.toLowerCase();
      if (!phrase || seen.has(key)) continue;
      seen.add(key);
      flagged.push({ phrase, reason, category });
    }
  }
  return { flagged };
}

/** Replaces flagged phrases so the model never sees the protected criterion. */
export function redactFlagged(text: string, flags: GuardrailFlag[]): string {
  let out = text;
  for (const f of flags) {
    const escaped = f.phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    out = out.replace(new RegExp(escaped, 'gi'), '[removed]');
  }
  return out;
}

/** The receipt text for Activity, for example "Guardrail: removed an age filter". */
export function guardrailMessage(flags: GuardrailFlag[]): string {
  const cats = [...new Set(flags.map((f) => f.category).filter((c): c is string => Boolean(c)))];
  if (cats.length === 0 || cats.length < new Set(flags.map((f) => f.phrase.toLowerCase())).size && flags.some((f) => !f.category)) {
    return `Guardrail: removed ${flags.map((f) => `"${f.phrase}"`).join(', ')}`;
  }
  if (cats.length === 1) {
    const c = cats[0] as string;
    return `Guardrail: removed ${/^[aeiou]/i.test(c) ? 'an' : 'a'} ${c} filter`;
  }
  return `Guardrail: removed ${cats.slice(0, -1).join(', ')} and ${cats[cats.length - 1]} filters`;
}
