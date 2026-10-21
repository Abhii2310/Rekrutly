import { z } from 'zod';
import { apiError, apiOk } from '@/lib/api';
import { getDb } from '@/lib/db/server';
import { env } from '@/lib/env';
import { logEvent } from '@/lib/events';
import { requireRecruiter } from '@/lib/security/require-recruiter';
import { decryptToken } from '@/lib/security/tokens';

export const dynamic = 'force-dynamic';

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const denied = await requireRecruiter();
  if (denied) return denied;
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) return apiError('not_found', 'Link not found.', 404);

  const inv = await getDb().from('invitations').select('id, candidate_id, token_encrypted, status, assessments(run_id, job_id)').eq('id', id).maybeSingle();
  if (inv.error) return apiError('db_error', "Couldn't load the link.", 500);
  if (!inv.data) return apiError('not_found', 'Link not found.', 404);
  if (inv.data.status === 'revoked') return apiError('revoked', 'This link was revoked.', 409);

  let token: string;
  try {
    token = decryptToken(inv.data.token_encrypted as string);
  } catch {
    return apiError('link_unreadable', "This link can't be read. Create a new one.", 500);
  }
  const a = inv.data.assessments as unknown as { run_id: string | null; job_id: string } | null;
  // The receipt records that the link was copied, never the link itself.
  await logEvent({ runId: a?.run_id ?? null, jobId: a?.job_id ?? null, candidateId: inv.data.candidate_id as string, type: 'invitation.link_copied', actor: 'recruiter', message: 'Copied a candidate link' });
  return apiOk({ url: `${env.APP_URL}/a/${token}` });
}
