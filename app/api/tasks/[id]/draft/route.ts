import { z } from 'zod';
import { apiError, apiOk, withErrors } from '@/lib/api';
import { AI_ERROR_STATUS } from '@/lib/ai/attempts';
import { createDraftForTask } from '@/lib/tasks/draft';
import { requireRecruiter } from '@/lib/security/require-recruiter';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

const Body = z.object({ language: z.enum(['en', 'hi', 'kn'], { error: 'Choose English, Hindi or Kannada.' }) });

async function handlePOST(request: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const denied = await requireRecruiter();
  if (denied) return denied;
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) return apiError('not_found', 'Task not found.', 404);
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return apiError('invalid_input', parsed.error.issues[0]?.message ?? 'Choose a language.', 400);

  const res = await createDraftForTask(id, parsed.data.language);
  if (!res.ok) {
    const code = res.error.code;
    const status = code === 'not_found' ? 404 : ['no_draft', 'not_open', 'no_candidate', 'no_assessment', 'no_invitation'].includes(code) ? 409
      : (AI_ERROR_STATUS[code as keyof typeof AI_ERROR_STATUS] ?? 502);
    const message = code === 'timeout' ? "Couldn't write the message because the AI took too long. Try again."
      : code === 'invalid_output' ? "Couldn't write the message in that language. Try again."
      : res.error.message;
    return apiError(code, message, status);
  }
  return apiOk({ draft: res.data.draft });
}

export const POST = withErrors(handlePOST);
