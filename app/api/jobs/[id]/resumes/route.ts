import 'server-only';
import { z } from 'zod';
import { apiError, apiOk, withErrors } from '@/lib/api';
import { extractResumeText, MAX_FILE_BYTES } from '@/lib/ats/extract';
import { parseIdentity } from '@/lib/ats/identity';
import { getDb } from '@/lib/db/server';
import { logEvent } from '@/lib/events';
import { requireRecruiter } from '@/lib/security/require-recruiter';

export const maxDuration = 60;
const MAX_FILES = 25;

export type ResumeResult = { file: string; status: 'added' | 'updated' | 'skipped'; name?: string; email?: string | null; reason?: string };

/**
 * Drop up to 25 resumes on a role. Each file becomes a candidate (name and email read from the text), or updates the
 * person who already has that email. Files that cannot be read are listed with the reason. Nothing is sent to anyone.
 */
async function handlePOST(request: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const denied = await requireRecruiter();
  if (denied) return denied;
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) return apiError('not_found', 'Job not found.', 404);
  const files = (await request.formData().catch(() => null))?.getAll('files').filter((f): f is File => f instanceof File) ?? [];
  if (files.length === 0) return apiError('invalid_input', 'Choose at least one resume.', 400);
  if (files.length > MAX_FILES) return apiError('invalid_input', `Add up to ${MAX_FILES} resumes at a time.`, 400);

  const db = getDb();
  const [job, existing] = await Promise.all([
    db.from('jobs').select('id, title').eq('id', id).maybeSingle(),
    db.from('candidates').select('id, email, full_name').eq('job_id', id),
  ]);
  if (job.error || existing.error) return apiError('db_error', "Couldn't load the role.", 500);
  if (!job.data) return apiError('not_found', 'Job not found.', 404);
  const byEmail = new Map((existing.data as { id: string; email: string | null }[]).filter((c) => c.email).map((c) => [(c.email as string).toLowerCase(), c.id]));

  const results: ResumeResult[] = [];
  for (const file of files) {
    if (file.size > MAX_FILE_BYTES) { results.push({ file: file.name, status: 'skipped', reason: 'Over 4 MB.' }); continue; }
    let text: string;
    try { text = await extractResumeText(file); } catch { results.push({ file: file.name, status: 'skipped', reason: "Couldn't read it." }); continue; }
    if (text.length < 40) { results.push({ file: file.name, status: 'skipped', reason: 'No text found (a scanned image?). Paste it on the profile instead.' }); continue; }
    const who = parseIdentity(text, file.name);
    const known = who.email ? byEmail.get(who.email) : undefined;
    if (known) {
      const up = await db.from('candidates').update({ resume_text: text, resume_match: null }).eq('id', known);
      results.push(up.error ? { file: file.name, status: 'skipped', reason: "Couldn't save it." } : { file: file.name, status: 'updated', name: who.name, email: who.email });
      continue;
    }
    const ins = await db.from('candidates').insert({
      job_id: id, full_name: who.name, email: who.email, source: 'Resume upload', stage: 'applied', resume_summary: '', skills: [], is_demo: false, resume_text: text,
    }).select('id').single();
    if (ins.error) { results.push({ file: file.name, status: 'skipped', reason: ins.error.code === '23505' ? 'Already in this role.' : "Couldn't save it." }); continue; }
    if (who.email) byEmail.set(who.email, ins.data.id as string);
    results.push({ file: file.name, status: 'added', name: who.name, email: who.email });
  }
  const added = results.filter((r) => r.status === 'added').length;
  const updated = results.filter((r) => r.status === 'updated').length;
  if (added + updated > 0) {
    await logEvent({ jobId: id, type: 'candidate.resume_added', actor: 'recruiter', level: 'success', message: `Uploaded ${files.length} ${files.length === 1 ? 'resume' : 'resumes'} for ${job.data.title as string}: ${added} new, ${updated} updated`, data: { added, updated } });
  }
  return apiOk({ results });
}

export const POST = withErrors(handlePOST);
