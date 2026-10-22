import 'server-only';
import { readResume } from '@/lib/ai/resume';
import { getDb } from '@/lib/db/server';
import { logEvent } from '@/lib/events';
import { err, ok, type Result } from '@/lib/result';
import { matchScore, redactResume, skillCoverage, verifiedQuotes, type ResumeMatch } from './rules';

/**
 * Scores the saved resume against the candidate's role and saves the result. The skills part is plain code over the text.
 * The AI adds a relevance read and a summary; if it fails the score is still saved, from skills alone, and says so.
 */
export async function scoreCandidateResume(candidateId: string): Promise<Result<ResumeMatch>> {
  const db = getDb();
  const c = await db.from('candidates').select('id, job_id, full_name, resume_text, jobs(title, description, skills)').eq('id', candidateId).maybeSingle();
  if (c.error) return err('db_error', "Couldn't load the candidate.", c.error.message);
  if (!c.data) return err('not_found', 'Candidate not found.');
  type Row = { job_id: string; full_name: string; resume_text: string | null; jobs: { title: string; description: string; skills: string[] } | null };
  const row = c.data as unknown as Row;
  if (!row.resume_text?.trim()) return err('no_resume', 'Add the resume first.');
  if (!row.jobs) return err('no_job', 'This candidate has no role yet.');

  const coverage = skillCoverage(row.resume_text, row.jobs.skills);
  const ai = await readResume({ jobTitle: row.jobs.title, jobDescription: row.jobs.description, skills: row.jobs.skills, resume: redactResume(row.resume_text) });

  const match: ResumeMatch = ai.ok
    ? {
        score: matchScore(coverage, ai.data.read.relevance), coverage, relevance: ai.data.read.relevance, summary: ai.data.read.summary,
        strengths: verifiedQuotes(row.resume_text, ai.data.read.strengths), gaps: ai.data.read.gaps,
        aiModel: `${ai.data.meta.provider}/${ai.data.meta.model}`, jobTitle: row.jobs.title, scoredAt: new Date().toISOString(),
      }
    : {
        score: matchScore(coverage, null), coverage, relevance: null,
        summary: `${coverage.matched.length} of ${coverage.matched.length + coverage.missing.length} skills the role needs appear in the resume. The AI read was not available, so this is the skills count only.`,
        strengths: [], gaps: coverage.missing.slice(0, 4).map((s) => `${s} not shown`), aiModel: null, jobTitle: row.jobs.title, scoredAt: new Date().toISOString(),
      };

  const up = await db.from('candidates').update({ resume_match: match }).eq('id', candidateId);
  if (up.error) return err('db_error', "Couldn't save the match.", up.error.message);
  await logEvent({
    jobId: row.job_id, candidateId, type: 'candidate.resume_scored', actor: ai.ok ? 'agent' : 'system', level: ai.ok ? 'success' : 'warning',
    message: `Resume match for ${row.full_name}: ${match.score}%${ai.ok ? '' : ' (skills only)'}`, data: { score: match.score, ai: ai.ok },
  });
  return ok(match);
}
