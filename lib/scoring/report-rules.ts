import type { CandidateReport } from '@/lib/ai/schemas';

const norm = (s: string): string => s.trim().toLowerCase();

function matchSkill(skill: string, allowed: readonly string[]): string | null {
  const s = norm(skill);
  if (!s) return null;
  return allowed.find((a) => norm(a) === s) ?? allowed.find((a) => s.includes(norm(a)) || norm(a).includes(s)) ?? null;
}

/**
 * Pure. Keeps a generated report honest:
 *  - every skill must exist in the job or the assessment (close matches are renamed, unknown ones dropped);
 *  - every strength and gap must carry evidence that appears in the provided evidence, otherwise it is replaced by the
 *    real evidence for that skill, or dropped when there is none;
 *  - interview questions keep their count (3 to 6): an unknown skill is relabelled with the weakest known one.
 */
export function checkReport(
  report: CandidateReport,
  ctx: { skills: readonly string[]; evidenceBySkill: Record<string, string[]>; weakestSkill: string },
): CandidateReport {
  const allEvidence = Object.values(ctx.evidenceBySkill).flat();
  const traceable = (text: string): boolean => {
    const t = norm(text);
    return t.length > 0 && allEvidence.some((e) => norm(e).includes(t));
  };

  const fixItems = <T extends { skill: string; evidence: string }>(items: T[]): T[] =>
    items.flatMap((item) => {
      const skill = matchSkill(item.skill, ctx.skills);
      if (!skill) return [];
      if (traceable(item.evidence)) return [{ ...item, skill }];
      const real = ctx.evidenceBySkill[skill]?.[0];
      return real ? [{ ...item, skill, evidence: real.slice(0, 300) }] : [];
    });

  return {
    ...report,
    strengths: fixItems(report.strengths),
    gaps: fixItems(report.gaps),
    interview_questions: report.interview_questions.map((q) => ({ ...q, skill: matchSkill(q.skill, ctx.skills) ?? ctx.weakestSkill })),
  };
}
