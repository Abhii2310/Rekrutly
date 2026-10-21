export type AggQuestion = { id: string; skill: string; type: 'mcq' | 'short'; max_score: number };
export type AggScore = {
  question_id: string;
  method: 'auto' | 'ai_suggested';
  score: number;
  max_score: number;
  overridden_score: number | null;
};

export type SkillScore = { skill: string; score: number; max: number; percent: number; question_ids: string[] };

export type Aggregate = {
  objective: { score: number; max: number };
  ai: { score: number; max: number };
  final: { score: number; max: number };
  skill_breakdown: SkillScore[];
};

/** The recruiter's override wins over the stored score. */
export const effectiveScore = (s: Pick<AggScore, 'score' | 'overridden_score'>): number => s.overridden_score ?? s.score;

const percent = (score: number, max: number): number => (max > 0 ? Math.round((score / max) * 100) : 0);

/**
 * Pure. Objective totals (plain-code multiple-choice scores), AI-suggested totals (written answers, before any
 * override), final totals (uses overrides), and a per-skill breakdown with whole-number percentages.
 * Only questions that have a score row count, so an ungraded written answer never lowers anyone's score.
 */
export function aggregate(questions: readonly AggQuestion[], scores: readonly AggScore[]): Aggregate {
  const byQuestion = new Map(questions.map((q) => [q.id, q]));
  const objective = { score: 0, max: 0 };
  const ai = { score: 0, max: 0 };
  const final = { score: 0, max: 0 };
  const bySkill = new Map<string, SkillScore>();

  for (const s of scores) {
    const q = byQuestion.get(s.question_id);
    if (!q) continue;
    const effective = effectiveScore(s);
    final.score += effective;
    final.max += s.max_score;
    if (q.type === 'mcq') {
      objective.score += s.score;
      objective.max += s.max_score;
    } else {
      ai.score += s.score;
      ai.max += s.max_score;
    }
    const k = bySkill.get(q.skill) ?? { skill: q.skill, score: 0, max: 0, percent: 0, question_ids: [] };
    k.score += effective;
    k.max += s.max_score;
    k.question_ids.push(q.id);
    bySkill.set(q.skill, k);
  }

  const skill_breakdown = [...bySkill.values()].map((k) => ({ ...k, score: round2(k.score), percent: percent(k.score, k.max) }));
  return {
    objective: { score: round2(objective.score), max: round2(objective.max) },
    ai: { score: round2(ai.score), max: round2(ai.max) },
    final: { score: round2(final.score), max: round2(final.max) },
    skill_breakdown,
  };
}

const round2 = (n: number): number => Math.round(n * 100) / 100;
export const toPercent = percent;
