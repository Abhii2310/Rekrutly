import 'server-only';
import { z } from 'zod';
import { apiError, apiOk, withErrors } from '@/lib/api';
import { getDb } from '@/lib/db/server';
import { logEvent } from '@/lib/events';
import { requireRecruiter } from '@/lib/security/require-recruiter';

const Body = z.object({
  title: z.string({ error: 'Give the role a title.' }).trim().min(2, 'The title needs at least 2 characters.').max(120, 'The title is too long.'),
  team: z.string().trim().max(80).optional(),
  location: z.string().trim().max(80).optional(),
  description: z.string().trim().max(2000, 'The description is too long.').optional(),
  skills: z.array(z.string().trim().min(1).max(40)).max(12, 'Add up to 12 skills.').optional(),
});

/** Creates a role. It is a real role (not demo data), so a demo reset never deletes it. */
async function handlePOST(request: Request): Promise<Response> {
  const denied = await requireRecruiter();
  if (denied) return denied;
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return apiError('invalid_input', parsed.error.issues[0]?.message ?? 'Check the details and try again.', 400);
  const b = parsed.data;
  const ins = await getDb().from('jobs').insert({
    title: b.title, team: b.team || null, location: b.location || null, employment_type: 'Full-time',
    description: b.description ?? '', skills: [...new Set(b.skills ?? [])], status: 'open', is_demo: false,
  }).select('id').single();
  if (ins.error) {
    console.error('create job failed:', ins.error.message);
    return apiError('db_error', "Couldn't create the role. Try again.", 500);
  }
  const id = ins.data.id as string;
  await logEvent({ jobId: id, type: 'job.created', actor: 'recruiter', level: 'success', message: `Created the role "${b.title}"` });
  return apiOk({ id }, 201);
}

export const POST = withErrors(handlePOST);
