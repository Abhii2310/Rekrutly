import 'server-only';
import { z } from 'zod';
import { apiError, apiOk, withErrors } from '@/lib/api';
import { extractResumeText, MAX_FILE_BYTES } from '@/lib/ats/extract';
import { MAX_RESUME_CHARS } from '@/lib/ats/rules';
import { getDb } from '@/lib/db/server';
import { logEvent } from '@/lib/events';
import { requireRecruiter } from '@/lib/security/require-recruiter';

export const maxDuration = 30;
/** Saves the resume text for a candidate, from pasted text or an uploaded PDF or text file. Only the text is kept, not the file. */
async function handlePOST(request: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const denied = await requireRecruiter();
  if (denied) return denied;
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) return apiError('not_found', 'Candidate not found.', 404);

  let text = '';
  const type = request.headers.get('content-type') ?? '';
  try {
    if (type.includes('multipart/form-data')) {
      const file = (await request.formData()).get('file');
      if (!(file instanceof File)) return apiError('invalid_input', 'Choose a file first.', 400);
      if (file.size > MAX_FILE_BYTES) return apiError('invalid_input', 'That file is too large. Use one under 4 MB.', 413);
      text = await extractResumeText(file);
    } else {
      const body = z.object({ text: z.string() }).safeParse(await request.json().catch(() => null));
      if (!body.success) return apiError('invalid_input', 'Paste the resume text first.', 400);
      text = body.data.text;
    }
  } catch {
    return apiError('unreadable', "Couldn't read that file. Paste the text instead.", 422);
  }
  text = text.replace(/\u0000/g, '').replace(/[ \t]+\n/g, '\n').trim().slice(0, MAX_RESUME_CHARS);
  if (text.length < 40) return apiError('invalid_input', 'That looks empty. If it is a scanned PDF, paste the text instead.', 422);

  const db = getDb();
  const cand = await db.from('candidates').select('id, job_id, full_name').eq('id', id).maybeSingle();
  if (cand.error) return apiError('db_error', "Couldn't load the candidate.", 500);
  if (!cand.data) return apiError('not_found', 'Candidate not found.', 404);
  const up = await db.from('candidates').update({ resume_text: text, resume_match: null }).eq('id', id);
  if (up.error) return apiError('db_error', "Couldn't save the resume.", 500);
  await logEvent({ jobId: cand.data.job_id as string, candidateId: id, type: 'candidate.resume_added', actor: 'recruiter', level: 'info', message: `Added a resume for ${cand.data.full_name as string}` });
  return apiOk({ chars: text.length });
}

export const POST = withErrors(handlePOST);
