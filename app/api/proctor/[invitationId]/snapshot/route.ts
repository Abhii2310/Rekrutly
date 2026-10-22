import 'server-only';
import { z } from 'zod';
import { apiError, withErrors } from '@/lib/api';
import { readSnapshot } from '@/lib/proctor/service';
import { requireRecruiter } from '@/lib/security/require-recruiter';

export const dynamic = 'force-dynamic';

/** The latest live picture for the War Room thumbnail. Recruiters only. */
async function handleGET(_request: Request, { params }: { params: Promise<{ invitationId: string }> }): Promise<Response> {
  const denied = await requireRecruiter();
  if (denied) return denied;
  const { invitationId } = await params;
  if (!z.uuid().safeParse(invitationId).success) return apiError('not_found', 'Not found.', 404);
  const bytes = await readSnapshot(invitationId);
  if (!bytes) return apiError('not_found', 'No picture yet.', 404);
  return new Response(bytes, { headers: { 'content-type': 'image/jpeg', 'cache-control': 'private, max-age=30' } });
}

export const GET = withErrors(handleGET);
