import 'server-only';
import { z } from 'zod';
import { apiError, apiOk, withErrors } from '@/lib/api';
import { getDb } from '@/lib/db/server';
import { logEvent } from '@/lib/events';
import { requireRecruiter } from '@/lib/security/require-recruiter';
import { CANDIDATE_STAGES, assertTransition, statusLabel, type Stage } from '@/lib/status';

const Body = z
  .object({
    email: z.string().trim().max(200).pipe(z.email()).nullable().optional(),
    stage: z.enum(CANDIDATE_STAGES).optional(),
  })
  .refine((v) => v.email !== undefined || v.stage !== undefined, { message: 'Nothing to change.' });

const COLUMNS =
  'id, job_id, full_name, email, phone, current_title, current_company, years_experience, location, skills, resume_summary, source, stage, is_demo, created_at, updated_at';

async function handlePATCH(request: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const denied = await requireRecruiter();
  if (denied) return denied;

  const { id } = await params;
  if (!z.uuid().safeParse(id).success) return apiError('not_found', 'Candidate not found.', 404);
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    const emailBad = parsed.error.issues.some((i) => i.path[0] === 'email');
    return apiError('invalid_input', emailBad ? 'Enter a valid email address.' : 'Nothing to change.', 400);
  }
  const { email, stage } = parsed.data;

  const db = getDb();
  const current = await db.from('candidates').select('id, job_id, full_name, email, stage').eq('id', id).maybeSingle();
  if (current.error) return apiError('db_error', 'Could not load the candidate.', 500);
  if (!current.data) return apiError('not_found', 'Candidate not found.', 404);
  const c = current.data as { id: string; job_id: string; full_name: string; email: string | null; stage: Stage };

  const update: Record<string, unknown> = {};
  if (stage !== undefined) {
    const t = assertTransition('candidate', c.stage, stage);
    if (!t.ok) {
      return apiError('invalid_transition', `${c.full_name} can't move from ${statusLabel('candidate', c.stage)} to ${statusLabel('candidate', stage)}.`, 409);
    }
    update.stage = stage;
  }
  if (email !== undefined) update.email = email;

  const { data, error } = await db.from('candidates').update(update).eq('id', id).select(COLUMNS).single();
  if (error) {
    if (error.code === '23505') return apiError('email_in_use', 'Another candidate for this job already uses that email.', 409);
    console.error('PATCH /api/candidates failed:', error.message);
    return apiError('db_error', 'Could not save the change.', 500);
  }

  const base = { jobId: c.job_id, candidateId: id, actor: 'recruiter' as const };
  if (stage !== undefined) {
    await logEvent({
      ...base, type: 'candidate.stage_changed', level: 'info',
      message: `Moved ${c.full_name} to ${statusLabel('candidate', stage)}`,
      data: { from: c.stage, to: stage },
    });
  }
  if (email !== undefined) {
    await logEvent({
      ...base, type: 'candidate.updated', level: 'info',
      message: email === null ? `Removed the email for ${c.full_name}` : c.email ? `Changed the email for ${c.full_name}` : `Added an email for ${c.full_name}`,
      data: { field: 'email' },
    });
  }
  return apiOk(data);
}

export const PATCH = withErrors(handlePATCH);
