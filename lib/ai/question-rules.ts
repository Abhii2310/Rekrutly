import type { GeneratedQuestion } from './schemas';

export type QuestionType = 'mcq' | 'short';
export type Difficulty = 'easy' | 'medium' | 'hard' | 'mixed';

/** Default mix is 70% multiple-choice and 30% short answer (10 becomes 7 + 3). */
export function splitTypes(count: number, types: readonly QuestionType[]): { mcq: number; short: number } {
  const hasMcq = types.includes('mcq');
  const hasShort = types.includes('short');
  if (hasMcq && !hasShort) return { mcq: count, short: 0 };
  if (hasShort && !hasMcq) return { mcq: 0, short: count };
  const mcq = Math.round(count * 0.7);
  return { mcq, short: count - mcq };
}

/** Even skill quotas, with the remainder going to the first skills. */
export function skillQuotas(count: number, skills: readonly string[]): { skill: string; count: number }[] {
  const base = Math.floor(count / skills.length);
  const extra = count % skills.length;
  return skills.map((skill, i) => ({ skill, count: base + (i < extra ? 1 : 0) }));
}

/** MCQ 1 to 2 points by difficulty, short answer 4 to 6. */
export function pointsFor(type: QuestionType, difficulty: 'easy' | 'medium' | 'hard'): number {
  if (type === 'mcq') return difficulty === 'easy' ? 1 : 2;
  return { easy: 4, medium: 5, hard: 6 }[difficulty];
}

/** Rough minutes a candidate needs: one per multiple-choice question, four per short answer. */
export function estimateMinutes(questions: readonly Pick<GeneratedQuestion, 'type'>[]): number {
  return questions.reduce((m, q) => m + (q.type === 'mcq' ? 1 : 4), 0);
}

function hashSeed(seed: string): number {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return h >>> 0;
}

/** Small deterministic RNG so shuffles are reproducible in tests. */
export function rng(seed: string): () => number {
  let a = hashSeed(seed);
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffled<T>(items: readonly T[], random: () => number): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [a[i], a[j]] = [a[j] as T, a[i] as T];
  }
  return a;
}

/**
 * Moves the correct option to `target` and shuffles the other options around it.
 * The returned `correct_option` always points at the same option text as before.
 */
export function placeCorrect(options: readonly string[], correct: number, target: number, random: () => number): { options: string[]; correct_option: number } {
  const right = options[correct] as string;
  const others = shuffled(options.filter((_, i) => i !== correct), random);
  const out: string[] = [];
  for (let i = 0; i < options.length; i++) out.push(i === target ? right : (others.shift() as string));
  return { options: out, correct_option: target };
}

/** Shuffles every MCQ so the correct answers spread evenly over A to D. */
export function spreadCorrectAnswers(questions: GeneratedQuestion[], seed: string): GeneratedQuestion[] {
  const random = rng(seed);
  let order: number[] = [];
  return questions.map((q) => {
    if (q.type !== 'mcq') return q;
    if (order.length === 0) order = shuffled([0, 1, 2, 3], random);
    const target = order.shift() as number;
    return { ...q, ...placeCorrect(q.options, q.correct_option, target, random) };
  });
}

function matchSkill(skill: string, allowed: readonly string[]): string | null {
  const s = skill.trim().toLowerCase();
  const exact = allowed.find((a) => a.toLowerCase() === s);
  if (exact) return exact;
  const loose = allowed.find((a) => s.includes(a.toLowerCase()) || a.toLowerCase().includes(s));
  return s && loose ? loose : null;
}

export type PostValidated = { questions: GeneratedQuestion[]; shortfall: number; warnings: string[] };

/**
 * Pure checks on what the model wrote: skills limited to the requested list, duplicates removed,
 * extras trimmed to the exact count, points set by code, correct answers spread across A to D,
 * and a warning if the questions probably will not fit in the time limit.
 */
export function postValidate(
  input: readonly GeneratedQuestion[],
  opts: { count: number; skills: readonly string[]; durationMinutes: number; seed: string; types?: readonly QuestionType[] },
): PostValidated {
  const warnings: string[] = [];
  const seen = new Set<string>();
  let kept: GeneratedQuestion[] = [];
  let droppedSkill = 0;

  for (const q of input) {
    const skill = matchSkill(q.skill, opts.skills);
    if (!skill) { droppedSkill++; continue; }
    const key = q.prompt.trim().toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    kept.push({ ...q, skill, max_score: pointsFor(q.type, q.difficulty) });
  }
  if (droppedSkill > 0) warnings.push(`${droppedSkill} ${droppedSkill === 1 ? 'question was' : 'questions were'} dropped because the skill wasn't one you asked for.`);

  if (opts.types) {
    const allowed = new Set<QuestionType>(opts.types);
    const before = kept.length;
    kept = kept.filter((q) => allowed.has(q.type));
    if (kept.length < before) warnings.push('Some questions were dropped because they were not an allowed type.');
  }

  if (kept.length > opts.count) kept = kept.slice(0, opts.count);
  const shortfall = Math.max(0, opts.count - kept.length);

  const spread = spreadCorrectAnswers(kept, opts.seed);
  const minutes = estimateMinutes(spread);
  if (minutes > opts.durationMinutes * 1.1) {
    warnings.push(`These questions may take about ${minutes} minutes, longer than the ${opts.durationMinutes} minute limit.`);
  }
  return { questions: spread, shortfall, warnings };
}

/**
 * Keeps at most the wanted number of each type (earliest first) and says how many of each are missing.
 * The model often drifts from the requested multiple-choice / short-answer split.
 */
export function balanceTypes(
  questions: readonly GeneratedQuestion[],
  want: { mcq: number; short: number },
): { kept: GeneratedQuestion[]; need: { mcq: number; short: number } } {
  const left = { ...want };
  const kept = questions.filter((q) => {
    if (left[q.type] <= 0) return false;
    left[q.type]--;
    return true;
  });
  return { kept, need: { mcq: Math.max(0, left.mcq), short: Math.max(0, left.short) } };
}

/** Skills ordered from least to most covered, so top-up questions go where coverage is thinnest. */
export function leastCoveredFirst(questions: readonly Pick<GeneratedQuestion, 'skill'>[], skills: readonly string[]): string[] {
  const count = (s: string) => questions.filter((q) => q.skill === s).length;
  return [...skills].sort((a, b) => count(a) - count(b));
}
