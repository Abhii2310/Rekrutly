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

export async function getAssessmentResults(assessmentId: string): Promise<Result<AssessmentResults | null>> {
  const db = getDb();
  const a = await db.from('assessments').select('id, title, duration_minutes, run_id').eq('id', assessmentId).maybeSingle();
  if (a.error) return err('db_error', "Couldn't load the assessment.", a.error.message);
  if (!a.data) return ok(null);
  const [inv, qc] = await Promise.all([
    db.from('invitations').select('id, candidate_id, status, current_question, candidates(full_name)').eq('assessment_id', assessmentId).order('candidate_id'),
    db.from('questions').select('id', { count: 'exact', head: true }).eq('assessment_id', assessmentId),
  ]);
  if (inv.error) return err('db_error', "Couldn't load the candidates.", inv.error.message);
  type InvRow = { id: string; candidate_id: string; status: string; current_question: number | null; candidates: { full_name: string } | null };
  const invitations = inv.data as unknown as InvRow[];
  const subs = invitations.length
    ? await db.from('submissions').select('id, invitation_id, objective_score, objective_max, ai_suggested_score, ai_suggested_max, final_score, final_max, scoring_status, report_status').in('invitation_id', invitations.map((i) => i.id))
    : { data: [], error: null };
  if (subs.error) return err('db_error', "Couldn't load the submissions.", subs.error.message);
  type SubRow = { id: string; invitation_id: string; objective_score: number | null; objective_max: number | null; ai_suggested_score: number | null; ai_suggested_max: number | null; final_score: number | null; final_max: number | null; scoring_status: string; report_status: string };
  const byInv = new Map((subs.data as unknown as SubRow[]).map((s) => [s.invitation_id, s]));
  const questionCount = qc.count ?? 0;

  const rows: ResultRow[] = invitations.map((i) => {
    const s = byInv.get(i.id) ?? null;
    return {
      invitationId: i.id, candidateId: i.candidate_id, name: i.candidates?.full_name ?? 'Candidate',
      state: resultState({ invitationStatus: i.status, currentQuestion: i.current_question, questionCount, submission: s }),
      submissionId: s?.id ?? null,
      objectivePct: s ? pct(s.objective_score, s.objective_max) : null,
      aiPct: s ? pct(s.ai_suggested_score, s.ai_suggested_max) : null,
      finalPct: s && s.scoring_status === 'scored' ? pct(s.final_score, s.final_max) : null,
    };
  });
  return ok({
    serverNow: new Date().toISOString(),
    assessment: { id: a.data.id as string, title: a.data.title as string, durationMinutes: a.data.duration_minutes as number, runId: (a.data.run_id as string | null) ?? null, questionCount },
    counts: {
      invited: invitations.length,
      started: invitations.filter((i) => i.status === 'started' || byInv.has(i.id)).length,
      submitted: byInv.size,
      ready: [...byInv.values()].filter((s) => s.scoring_status === 'scored' && s.report_status === 'ready').length,
    },
    rows,
  });
}
