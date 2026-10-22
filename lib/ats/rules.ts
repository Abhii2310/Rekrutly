/** Pure resume-matching rules. The skill part of the score is plain code over the resume text, so it can be checked by hand. */

export const MAX_RESUME_CHARS = 20_000;

/** Removes contact details before any text goes to a model. Names stay in the file; the prompt tells the model to ignore them. */
export function redactResume(text: string): string {
  return text
    .replace(/[\w.+-]+@[\w-]+(\.[\w-]+)+/g, '[email]')
    .replace(/https?:\/\/\S+/g, '[link]')
    .replace(/(?:\+?\d[\s().-]?){8,}\d/g, '[phone]')
    .slice(0, MAX_RESUME_CHARS);
}

const ALIASES: Record<string, string[]> = {
  react: ['react', 'reactjs', 'react.js'],
  typescript: ['typescript', 'ts'],
  javascript: ['javascript', 'js', 'es6'],
  'node.js': ['node.js', 'nodejs', 'node'],
  postgresql: ['postgresql', 'postgres', 'psql'],
  'rest apis': ['rest api', 'rest apis', 'restful', 'rest'],
  sql: ['sql', 'mysql', 'postgresql', 'postgres', 'sqlite'],
  debugging: ['debugging', 'debug', 'troubleshooting'],
  'next.js': ['next.js', 'nextjs', 'next'],
  go: ['golang', 'go lang', 'go'],
  figma: ['figma'],
};

const norm = (s: string): string => s.toLowerCase().replace(/\s+/g, ' ').trim();
const escapeRe = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Words an skill may appear as in a resume. Unknown skills match as written. */
export function termsFor(skill: string): string[] {
  const key = norm(skill);
  return ALIASES[key] ?? [key];
}

/** True when the resume mentions any form of the skill as a whole word or phrase. */
export function mentions(resume: string, skill: string): boolean {
  const text = norm(resume);
  return termsFor(skill).some((t) => new RegExp(`(^|[^a-z0-9])${escapeRe(t)}($|[^a-z0-9])`, 'i').test(text));
}

export type Coverage = { matched: string[]; missing: string[]; ratio: number };

/** Which of the role's skills the resume mentions, and which it does not. */
export function skillCoverage(resume: string, jobSkills: readonly string[]): Coverage {
  const skills = [...new Set(jobSkills.map((s) => s.trim()).filter(Boolean))];
  const matched = skills.filter((s) => mentions(resume, s));
  const missing = skills.filter((s) => !matched.includes(s));
  return { matched, missing, ratio: skills.length === 0 ? 0 : matched.length / skills.length };
}

export const SKILL_WEIGHT = 0.7;

/**
 * The match score, 0 to 100: 70% skills the resume mentions (code) and 30% how relevant the experience reads (AI, 0 to 1).
 * Without the AI part the score is the skill coverage alone, and says so.
 */
export function matchScore(coverage: Coverage, relevance: number | null): number {
  if (relevance === null) return Math.round(coverage.ratio * 100);
  const r = Math.min(1, Math.max(0, relevance));
  return Math.round((SKILL_WEIGHT * coverage.ratio + (1 - SKILL_WEIGHT) * r) * 100);
}

const squash = (s: string): string => s.replace(/\s+/g, ' ').trim().toLowerCase();

/** Keeps only quotes that really are in the resume, so the model cannot invent evidence. */
export function verifiedQuotes<T extends { quote: string }>(resume: string, items: T[]): T[] {
  const hay = squash(resume);
  return items.filter((i) => i.quote.trim().length >= 8 && hay.includes(squash(i.quote)));
}

export type ResumeMatch = {
  score: number;
  coverage: Coverage;
  /** 0 to 1, suggested by AI. Null when the AI could not be reached. */
  relevance: number | null;
  summary: string;
  strengths: { point: string; quote: string }[];
  gaps: string[];
  aiModel: string | null;
  jobTitle: string;
  scoredAt: string;
};
