import 'server-only';
import { apiError, apiOk, withErrors } from '@/lib/api';
import { getState } from '@/lib/ai-interview/service';
import { withInvitation } from '@/lib/portal/http';

export const dynamic = 'force-dynamic';

/** Where the candidate is in their AI interview, so a refresh picks up where they were. */
async function handleGET(_request: Request, { params }: { params: Promise<{ token: string }> }): Promise<Response> {
  const { token } = await params;
  const found = await withInvitation(token);
  if ('response' in found) return found.response;
  const { inv } = found;
  if (!inv.assessment.ai_interview || !inv.submitted_at) return apiError('not_available', 'There is no interview to take yet.', 409);
  return apiOk(await getState(inv));
}

export const GET = withErrors(handleGET);
