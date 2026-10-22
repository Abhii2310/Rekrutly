import { apiError, apiOk, withErrors } from '@/lib/api';
import { withInvitation } from '@/lib/portal/http';
import { canWriteAnswers } from '@/lib/portal/state';
import { MAX_SEGMENT_BYTES, saveSegment } from '@/lib/proctor/service';

export const maxDuration = 30;

/** One 30-second piece of the recording. Only a proctored test the candidate agreed to accepts it. */
async function handlePOST(request: Request, { params }: { params: Promise<{ token: string }> }): Promise<Response> {
  const { token } = await params;
  const found = await withInvitation(token);
  if ('response' in found) return found.response;
  const { inv } = found;
  if (!inv.assessment.proctored || !inv.proctor_consent_at) return apiError('not_proctored', 'Recording is not part of this assessment.', 409);
  if (!canWriteAnswers(inv, new Date())) return apiError('closed', 'This assessment is closed.', 409);

  const url = new URL(request.url);
  const seq = Number(url.searchParams.get('seq'));
  const startedMs = Number(url.searchParams.get('startedMs'));
  const durationMs = Number(url.searchParams.get('durationMs'));
  if (![seq, startedMs, durationMs].every((n) => Number.isInteger(n) && n >= 0) || seq > 1000) return apiError('invalid_input', 'Check the recording details.', 400);
  const contentType = (request.headers.get('content-type') ?? 'video/webm').split(';')[0] ?? 'video/webm';
  if (!['video/webm', 'video/mp4'].includes(contentType)) return apiError('invalid_input', 'Unsupported recording type.', 400);

  const body = await request.arrayBuffer();
  if (body.byteLength === 0 || body.byteLength > MAX_SEGMENT_BYTES) return apiError('invalid_input', 'The recording piece is empty or too large.', 413);
  const saved = await saveSegment(inv.id, seq, startedMs, durationMs, body, contentType);
  if (!saved.ok) return apiError(saved.error.code, saved.error.message, 500);
  return apiOk({ seq });
}

export const POST = withErrors(handlePOST);
