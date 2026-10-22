export type SkillScore = { skill: string; percent: number };
export type GrowthReport = {
  overallPct: number | null;
  strong: SkillScore[];
  growing: SkillScore[];
  all: SkillScore[];
  steps: { skill: string; tip: string }[];
};

const STRONG_AT = 70;
const GROWING_BELOW = 60;

/** Practice ideas that never mention a question or an answer, so nothing from the answer key leaves the server. */
const TIPS = [
  (s: string) => `Build one small project this week that leans on ${s}, and write down what you had to look up.`,
  (s: string) => `Read the official docs for ${s} for 30 minutes, then rebuild a feature you already know without copying.`,
  (s: string) => `Solve three short practice problems on ${s} and explain each solution out loud, as if to a teammate.`,
];

/**
 * Turns skill percentages into a kind, plain report for the candidate. Pure code: no AI, no ranking against other people,
 * no hiring verdict. Only the candidate's own numbers, strongest first.
 */
export function growthReport(overallPct: number | null, skills: SkillScore[]): GrowthReport {
  const all = [...skills].filter((s) => Number.isFinite(s.percent)).map((s) => ({ skill: s.skill, percent: Math.max(0, Math.min(100, Math.round(s.percent))) })).sort((a, b) => b.percent - a.percent);
  const strong = all.filter((s) => s.percent >= STRONG_AT);
  const growing = all.filter((s) => s.percent < GROWING_BELOW).reverse().slice(0, 3);
  return { overallPct, strong, growing, all, steps: growing.map((s, i) => ({ skill: s.skill, tip: (TIPS[i % TIPS.length] ?? TIPS[0] ?? ((k: string) => `Practise ${k}.`))(s.skill) })) };
}

/** The line added to a rejection email when the recruiter chooses to share the report. */
export function reportLine(url: string): string {
  return `\n\nWe also made you a private report of your own results, with what you did well and what to practise next. It is only for you: ${url}`;
}
