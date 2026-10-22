import 'server-only';
import { after } from 'next/server';
import { z } from 'zod';
import { apiError, apiOk, withErrors } from '@/lib/api';
import { answer } from '@/lib/ai-interview/service';
import { MAX_ANSWER_CHARS } from '@/lib/ai-interview/rules';
import { getDb } from '@/lib/db/server';
import { withInvitation } from '@/lib/portal/http';
import { summarize } from '@/lib/ai-interview/service';

export const maxDuration = 60;
const Body = z.object({ text: z.string().max(MAX_ANSWER_CHARS * 2).default(''), skipped: z.boolean().default(false), promptId: z.number().int().min(0).max(100).optional() });

/** One answer in, the AI's next line out. When the conversation ends, the evidence notes are written after the response. */
async function handlePOST(request: Request, { params }: { params: Promise<{ token: string }> }): Promise<Response> {
  const { token } = await params;
  const found = await withInvitation(token);
  if ('response' in found) return found.response;
  const { inv } = found;
  if (!inv.assessment.ai_interview || !inv.submitted_at) return apiError('not_available', 'There is no interview to take.', 409);
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return apiError('invalid_input', 'Send your answer as text.', 400);
  const res = await answer(inv, parsed.data.text, parsed.data.skipped || parsed.data.text.trim().length === 0, new Date(), parsed.data.promptId);
  if (!res.ok) return apiError(res.error.code, res.error.message, res.error.code === 'not_started' ? 409 : 500);
  if (res.data.done) {
    after(async () => {
      const row = await getDb().from('ai_interviews').select('id').eq('invitation_id', inv.id).maybeSingle();
      if (row.data) await summarize(row.data.id as string);
    });
  }
  return apiOk(res.data);
}

export const POST = withErrors(handlePOST);
