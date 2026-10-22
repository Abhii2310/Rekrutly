import 'server-only';
import { z } from 'zod';
import { apiError, apiOk, withErrors } from '@/lib/api';
import { chat } from '@/lib/ai-task/service';
import { MAX_MESSAGE_CHARS } from '@/lib/ai-task/rules';
import { withInvitation } from '@/lib/portal/http';

export const maxDuration = 60;
const Body = z.object({ text: z.string().max(MAX_MESSAGE_CHARS * 2), chatLength: z.number().int().min(0).max(100).optional() });

async function handlePOST(request: Request, { params }: { params: Promise<{ token: string }> }): Promise<Response> {
  const { token } = await params;
  const found = await withInvitation(token);
  if ('response' in found) return found.response;
  const { inv } = found;
  if (!inv.assessment.ai_task || !inv.submitted_at) return apiError('not_available', 'There is no task to do.', 409);
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return apiError('invalid_input', 'Send your message as text.', 400);
  const res = await chat(inv, parsed.data.text, parsed.data.chatLength, new Date());
  if (!res.ok) return apiError(res.error.code, res.error.message, res.error.code === 'not_started' ? 409 : res.error.code === 'db_error' ? 500 : 400);
  return apiOk(res.data);
}

export const POST = withErrors(handlePOST);
