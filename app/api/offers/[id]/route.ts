import 'server-only';
import { z } from 'zod';
import { apiError, apiOk, withErrors } from '@/lib/api';
import { getDb } from '@/lib/db/server';
import { requireRecruiter } from '@/lib/security/require-recruiter';

const Body = z.object({ body: z.string().trim().min(40, 'The letter looks too short.').max(8000) });

/** Saves edits to a draft. A letter that was already sent is never changed. */
async function handlePATCH(request: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const denied = await requireRecruiter();
  if (denied) return denied;
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) return apiError('not_found', 'Offer not found.', 404);
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return apiError('invalid_input', parsed.error.issues[0]?.message ?? 'Check the letter.', 400);
  const db = getDb();
  const upd = await db.from('offers').update({ body: parsed.data.body, updated_at: new Date().toISOString() }).eq('id', id).eq('status', 'draft').select('id');
  if (upd.error) return apiError('db_error', "Couldn't save the letter.", 500);
  if (!upd.data || upd.data.length === 0) return apiError('not_editable', 'This letter was already sent, so it can no longer be changed.', 409);
  return apiOk({ saved: true });
}

async function handleDELETE(_request: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const denied = await requireRecruiter();
  if (denied) return denied;
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) return apiError('not_found', 'Offer not found.', 404);
  const del = await getDb().from('offers').delete().eq('id', id).eq('status', 'draft').select('id');
  if (del.error) return apiError('db_error', "Couldn't delete the draft.", 500);
  if (!del.data || del.data.length === 0) return apiError('not_editable', 'Only drafts can be deleted.', 409);
  return apiOk({ deleted: true });
}

export const PATCH = withErrors(handlePATCH);
export const DELETE = withErrors(handleDELETE);
