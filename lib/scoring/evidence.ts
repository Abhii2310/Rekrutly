export type ResultForReport = {
  skill: string;
  type: 'mcq' | 'short';
  promptSummary: string;
  score: number;
  max: number;
  unanswered: boolean;
  /** Written answers only: the exact quote the grader pointed to, if it checked out. */
  evidenceQuote: string | null;
  method: 'auto' | 'ai_suggested';
};

export type Evidence = { lines: string[]; bySkill: Record<string, string[]>; weakestSkill: string };

const summarise = (text: string): string => text.replace(/```[\s\S]*?```/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 140);

/**
 * Pure. The only facts the report may use, as plain lines. Nothing personal: no name, email or other candidate data.
 */
export function buildEvidence(results: readonly ResultForReport[], fallbackSkill: string): Evidence {
  const lines: string[] = [];
  const bySkill: Record<string, string[]> = {};
  const totals = new Map<string, { score: number; max: number }>();

  for (const r of results) {
    const kind = r.type === 'mcq' ? 'multiple choice' : 'written answer';
    const outcome = r.unanswered ? 'not answered' : `${r.score} of ${r.max} points${r.method === 'ai_suggested' ? ' (graded by AI)' : ''}`;
    const quote = r.evidenceQuote ? ` Quote from the answer: "${r.evidenceQuote}"` : '';
    const line = `${r.skill}, ${kind}, ${outcome}: "${summarise(r.promptSummary)}"${quote}`;
    lines.push(line);
    (bySkill[r.skill] ??= []).push(line);
    const t = totals.get(r.skill) ?? { score: 0, max: 0 };
    totals.set(r.skill, { score: t.score + r.score, max: t.max + r.max });
  }

  let weakest = fallbackSkill;
  let lowest = Infinity;
  for (const [skill, t] of totals) {
    const ratio = t.max > 0 ? t.score / t.max : 1;
    if (ratio < lowest) { lowest = ratio; weakest = skill; }
  }
  return { lines, bySkill, weakestSkill: weakest };
}
