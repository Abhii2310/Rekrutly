import 'server-only';
import { getDb } from '@/lib/db/server';
import { err, ok, type Result } from '@/lib/result';
import { resultState } from '@/lib/scoring/labels';

export type ResultRow = {
  invitationId: string;
  candidateId: string;
  name: string;
  state: { label: string; tone: 'neutral' | 'action' | 'success' | 'warning' | 'danger' | 'ai' };
  submissionId: string | null;
  objectivePct: number | null;
  aiPct: number | null;
  finalPct: number | null;
};

export type AssessmentResults = {
  serverNow: string;
  assessment: { id: string; title: string; durationMinutes: number; runId: string | null; questionCount: number };
  counts: { invited: number; started: number; submitted: number; ready: number };
  rows: ResultRow[];
};

const pct = (score: number | null, max: number | null): number | null => (score !== null && max !== null && Number(max) > 0 ? Math.round((Number(score) / Number(max)) * 100) : null);

/** One round trip: the assessment with its question count, candidates and their submissions embedded. */
export async function getAssessmentResults(assessmentId: string): Promise<Result<AssessmentResults | null>> {
  const a = await getDb().from('assessments').select(
    'id, title, duration_minutes, run_id, questions(count), invitations(id, candidate_id, status, current_question, candidates(full_name), submissions(id, invitation_id, objective_score, objective_max, ai_suggested_score, ai_suggested_max, final_score, final_max, scoring_status, report_status))',
  ).eq('id', assessmentId).maybeSingle();
  if (a.error) return err('db_error', "Couldn't load the assessment.", a.error.message);
  if (!a.data) return ok(null);
  type SubRow = { id: string; invitation_id: string; objective_score: number | null; objective_max: number | null; ai_suggested_score: number | null; ai_suggested_max: number | null; final_score: number | null; final_max: number | null; scoring_status: string; report_status: string };
  type InvRow = { id: string; candidate_id: string; status: string; current_question: number | null; candidates: { full_name: string } | null; submissions: SubRow | SubRow[] | null };
  const emb = a.data as unknown as { id: string; title: string; duration_minutes: number; run_id: string | null; questions: { count: number }[]; invitations: InvRow[] };
  const invitations = [...(emb.invitations ?? [])].sort((x, y) => x.candidate_id.localeCompare(y.candidate_id));
  const subOf = (i: InvRow): SubRow | null => (Array.isArray(i.submissions) ? (i.submissions[0] ?? null) : i.submissions);
  const questionCount = emb.questions?.[0]?.count ?? 0;

  const rows: ResultRow[] = invitations.map((i) => {
    const s = subOf(i);
    return {
      invitationId: i.id, candidateId: i.candidate_id, name: i.candidates?.full_name ?? 'Candidate',
      state: resultState({ invitationStatus: i.status, currentQuestion: i.current_question, questionCount, submission: s }),
      submissionId: s?.id ?? null,
      objectivePct: s ? pct(s.objective_score, s.objective_max) : null,
      aiPct: s ? pct(s.ai_suggested_score, s.ai_suggested_max) : null,
      finalPct: s && s.scoring_status === 'scored' ? pct(s.final_score, s.final_max) : null,
    };
  });
  const subs = invitations.map(subOf).filter((s): s is SubRow => s !== null);
  return ok({
    serverNow: new Date().toISOString(),
    assessment: { id: emb.id, title: emb.title, durationMinutes: emb.duration_minutes, runId: emb.run_id ?? null, questionCount },
    counts: {
      invited: invitations.length,
      started: invitations.filter((i) => i.status === 'started' || subOf(i) !== null).length,
      submitted: subs.length,
      ready: subs.filter((s) => s.scoring_status === 'scored' && s.report_status === 'ready').length,
    },
    rows,
  });
}
