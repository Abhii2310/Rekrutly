import 'server-only';
import { z } from 'zod';
import { apiError, apiOk, withErrors } from '@/lib/api';
import { getDb } from '@/lib/db/server';
import { logEvent } from '@/lib/events';
import { requireRecruiter } from '@/lib/security/require-recruiter';

const Body = z.object({
  full_name: z.string({ error: 'Enter their name.' }).trim().min(2, 'Name needs at least 2 characters.').max(120, 'Name is too long.'),
  email: z.string().trim().max(200).pipe(z.email('Enter a valid email address.')).nullable().default(null),
  current_title: z.string().trim().max(120, 'Role is too long.').nullable().default(null),
  phone: z.string().trim().max(30).nullable().default(null),
});

/** Adds one candidate to a job by hand. Nothing is sent to anyone. */
async function handlePOST(request: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const denied = await requireRecruiter();
  if (denied) return denied;
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) return apiError('not_found', 'Job not found.', 404);
  const raw = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  // Empty form fields arrive as empty strings; treat them as "not given".
  const cleaned = Object.fromEntries(Object.entries(raw ?? {}).map(([k, v]) => [k, typeof v === 'string' && v.trim() === '' && k !== 'full_name' ? null : v]));
  const parsed = Body.safeParse(cleaned);
  if (!parsed.success) return apiError('invalid_input', parsed.error.issues[0]?.message ?? 'Check the details and try again.', 400);
  const c = parsed.data;

  const db = getDb();
  const job = await db.from('jobs').select('id, title').eq('id', id).maybeSingle();
  if (job.error) return apiError('db_error', "Couldn't load the job.", 500);
  if (!job.data) return apiError('not_found', 'Job not found.', 404);

  const ins = await db.from('candidates')
    .insert({ ...c, job_id: id, source: 'Added by hand', stage: 'applied', resume_summary: '', skills: [], is_demo: false })
    .select('id').single();
  if (ins.error) {
    if (ins.error.code === '23505') return apiError('email_in_use', 'Someone in this job already uses that email.', 409);
    console.error('add candidate failed:', ins.error.message);
    return apiError('db_error', "Couldn't add the candidate.", 500);
  }
  await logEvent({
    jobId: id, candidateId: ins.data.id as string, type: 'candidate.imported', actor: 'recruiter', level: 'success',
    message: `Added ${c.full_name} to ${job.data.title as string}`, data: { created: 1 },
  });
  return apiOk({ id: ins.data.id as string });
}

export const POST = withErrors(handlePOST);
