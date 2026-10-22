import 'server-only';
import { getDb } from '@/lib/db/server';
import { err, ok, type Result } from '@/lib/result';
import { ALERT_SIGNALS } from '@/lib/proctor/signals';
import { listSegments, type SegmentView } from '@/lib/proctor/service';

export type Flagged = { id: string; type: string; occurredAt: string; videoMs: number | null };
export type ProctorReview = {
  invitationId: string;
  candidate: { name: string };
  assessmentTitle: string;
  proctored: boolean;
  consentAt: string | null;
  submissionId: string | null;
  segments: SegmentView[];
  flagged: Flagged[];
};

/** Everything the review page needs: who, the recording pieces (signed links) and the flagged moments. */
export async function getProctorReview(invitationId: string): Promise<Result<ProctorReview | null>> {
  const db = getDb();
  const inv = await db.from('invitations')
    .select('id, proctor_consent_at, candidates(full_name), assessments(title, proctored), submissions(id)')
    .eq('id', invitationId).maybeSingle();
  if (inv.error) return err('db_error', "Couldn't load the recording.", inv.error.message);
  if (!inv.data) return ok(null);
  type Row = { proctor_consent_at: string | null; candidates: { full_name: string } | null; assessments: { title: string; proctored: boolean } | null; submissions: { id: string }[] | { id: string } | null };
  const row = inv.data as unknown as Row;
  const [sigs, segs] = await Promise.all([
    db.from('integrity_signals').select('id, type, occurred_at, video_ms').eq('invitation_id', invitationId).order('occurred_at'),
    listSegments(invitationId),
  ]);
  if (sigs.error) return err('db_error', "Couldn't load the flagged moments.", sigs.error.message);
  if (!segs.ok) return segs;
  const sub = Array.isArray(row.submissions) ? row.submissions[0] : row.submissions;
  return ok({
    invitationId,
    candidate: { name: row.candidates?.full_name ?? 'Candidate' },
    assessmentTitle: row.assessments?.title ?? 'Assessment',
    proctored: Boolean(row.assessments?.proctored),
    consentAt: row.proctor_consent_at,
    submissionId: sub?.id ?? null,
    segments: segs.data,
    flagged: (sigs.data as { id: string; type: string; occurred_at: string; video_ms: number | null }[])
      .filter((s) => ALERT_SIGNALS.has(s.type))
      .map((s) => ({ id: s.id, type: s.type, occurredAt: s.occurred_at, videoMs: s.video_ms })),
  });
}
