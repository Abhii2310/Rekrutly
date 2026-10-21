/** Pure helpers for simulated candidates. Deterministic for a given seed, so tests and re-runs are repeatable. */

/** Small seeded random numbers (mulberry32). The same seed always gives the same sequence. */
export function seededRandom(seed: string): () => number {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  let a = h >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Words that, in a candidate's skill list, show experience with a question skill.
const STEMS: Record<string, string[]> = {
  react: ['react', 'next', 'frontend', 'typescript', 'javascript'],
  apis: ['api', 'rest', 'graphql', 'node', 'express'],
  sql: ['sql', 'postgres', 'database', 'mysql'],
  debugging: ['debug', 'incident', 'observab'],
  go: ['go'],
  postgresql: ['postgres', 'sql'],
  'distributed systems': ['distributed', 'queue', 'kubernetes'],
  kubernetes: ['kubernetes', 'docker'],
};

const norm = (s: string): string => s.toLowerCase().replace(/[^a-z0-9. ]/g, ' ').replace(/\s+/g, ' ').trim();

/**
 * How well a candidate is likely to do on a question about `questionSkill`, 0 to 1.
 * Strong in the skills on their profile, middling in related ones, weaker elsewhere. A small seeded jitter keeps
 * two candidates with the same skills from answering identically.
 */
export function skillStrength(candidateSkills: readonly string[], questionSkill: string, rand: () => number): number {
  const q = norm(questionSkill);
  const mine = candidateSkills.map(norm);
  const stems = STEMS[q] ?? [q];
  const direct = mine.some((s) => s === q || s.includes(q) || (q.length > 3 && q.includes(s)));
  const related = mine.some((s) => stems.some((t) => (t.length <= 2 ? s.split(' ').includes(t) : s.includes(t))));
  const base = direct ? 0.88 : related ? 0.7 : 0.38;
  return Math.min(0.97, Math.max(0.08, base + (rand() - 0.5) * 0.16));
}

/** The right option with probability `strength`, otherwise one of the wrong options. */
export function chooseOption(strength: number, correct: number, optionCount: number, rand: () => number): number {
  if (optionCount < 2) return correct;
  if (rand() < strength) return correct;
  const wrong = Array.from({ length: optionCount }, (_, i) => i).filter((i) => i !== correct);
  return wrong[Math.floor(rand() * wrong.length)] ?? correct;
}

/** "strong", "mixed" or "weak", for the answer-writing prompt. */
export const strengthLabel = (s: number): 'strong' | 'mixed' | 'weak' => (s >= 0.75 ? 'strong' : s >= 0.5 ? 'mixed' : 'weak');

/** Used when the model cannot write an answer: a short, plausible, plainly generic answer at the right level. */
export function templatedAnswer(strength: number, skill: string): string {
  const label = strengthLabel(strength);
  if (label === 'strong') {
    return `I would approach this step by step. First I would reproduce the problem and look at the evidence for ${skill}: logs, metrics and recent changes. Then I would narrow it down to one cause, fix it, and add a test so it cannot return. Finally I would write down what happened for the team.`;
  }
  if (label === 'mixed') {
    return `I would start by checking the logs and the recent changes related to ${skill}, and try to reproduce it. After that I would fix the most likely cause and test it again.`;
  }
  return `I have not done this a lot with ${skill}. I would search for the error and try the common fixes.`;
}
