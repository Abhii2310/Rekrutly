import 'server-only';
import { getDb } from '@/lib/db/server';
import { err, ok, type Result } from '@/lib/result';
import type { CandidateRow, WorkflowEventRow } from '@/lib/db/types';
import type { Stage } from '@/lib/status';

const CANDIDATE_COLUMNS =
  'id, job_id, full_name, email, phone, current_title, current_company, years_experience, location, skills, resume_summary, source, stage, is_demo, created_at, updated_at';
const EVENT_COLUMNS = 'id, run_id, step_id, job_id, candidate_id, type, actor, level, message, data, is_simulated, created_at';

export type CandidateListItem = CandidateRow & { job_title: string | null };
export type CandidateAssessment = { invitationId: string; title: string; status: string; submissionId: string | null; finalPct: number | null; scored: boolean };
export type CandidateDetail = CandidateListItem & { events: WorkflowEventRow[]; assessments: CandidateAssessment[] };

export type CandidateFilters = { jobId?: string; stage?: Stage | Stage[]; search?: string };

/** Strip characters that have meaning inside a PostgREST `or()` filter. */
function safeSearch(s: string): string {
  return s.replace(/[%_,()*\\]/g, ' ').trim();
}

type JoinedRow = CandidateRow & { jobs: { title: string } | null };

function flatten({ jobs, ...rest }: JoinedRow): CandidateListItem {
  return { ...rest, job_title: jobs?.title ?? null };
}

export async function listCandidates(filters: CandidateFilters = {}): Promise<Result<CandidateListItem[]>> {
  let q = getDb().from('candidates').select(`${CANDIDATE_COLUMNS}, jobs(title)`).order('created_at', { ascending: true }).order('id', { ascending: true });
  if (filters.jobId) q = q.eq('job_id', filters.jobId);
  if (filters.stage) q = Array.isArray(filters.stage) ? q.in('stage', filters.stage) : q.eq('stage', filters.stage);
  const term = filters.search ? safeSearch(filters.search) : '';
  if (term) {
    q = q.or(`full_name.ilike.%${term}%,current_title.ilike.%${term}%,current_company.ilike.%${term}%`);
  }
  const { data, error } = await q;
  if (error) return err('db_error', 'Could not load candidates.', error.message);
  return ok((data as unknown as JoinedRow[]).map(flatten));
}

export async function getCandidate(id: string): Promise<Result<CandidateDetail | null>> {
  const db = getDb();
  const [cand, events, invs] = await Promise.all([
    db.from('candidates').select(`${CANDIDATE_COLUMNS}, jobs(title)`).eq('id', id).maybeSingle(),
    db.from('workflow_events').select(EVENT_COLUMNS).eq('candidate_id', id).order('id', { ascending: false }).limit(20),
    db.from('invitations').select('id, status, assessments(title), submissions(id, final_score, final_max, scoring_status)').eq('candidate_id', id).order('created_at', { ascending: false }),
  ]);
  if (cand.error) return err('db_error', 'Could not load the candidate.', cand.error.message);
  if (events.error) return err('db_error', 'Could not load activity.', events.error.message);
  if (invs.error) return err('db_error', 'Could not load assessments.', invs.error.message);
  if (!cand.data) return ok(null);
  type InvRow = { id: string; status: string; assessments: { title: string } | null; submissions: { id: string; final_score: number | null; final_max: number | null; scoring_status: string }[] | { id: string; final_score: number | null; final_max: number | null; scoring_status: string } | null };
  const assessments: CandidateAssessment[] = (invs.data as unknown as InvRow[]).map((i) => {
    const s = Array.isArray(i.submissions) ? i.submissions[0] : i.submissions;
    const scored = s?.scoring_status === 'scored' && s.final_score !== null && Number(s.final_max) > 0;
    return {
      invitationId: i.id, title: i.assessments?.title ?? 'Assessment', status: i.status, submissionId: s?.id ?? null,
      finalPct: scored && s ? Math.round((Number(s.final_score) / Number(s.final_max)) * 100) : null, scored: Boolean(scored),
    };
  });
  return ok({ ...flatten(cand.data as unknown as JoinedRow), events: events.data as unknown as WorkflowEventRow[], assessments });
}
