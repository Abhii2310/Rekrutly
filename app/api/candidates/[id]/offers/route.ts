import 'server-only';
import { z } from 'zod';
import { apiError, apiOk, withErrors } from '@/lib/api';
import { getDb } from '@/lib/db/server';
import { logEvent } from '@/lib/events';
import { offerLetter } from '@/lib/offers/template';
import { requireRecruiter } from '@/lib/security/require-recruiter';

const Body = z.object({
  company: z.string().trim().min(1, 'Enter the company name.').max(120),
  compensation: z.string().trim().max(200).default(''),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Pick a valid start date.').nullable().default(null),
  signerName: z.string().trim().min(1, 'Enter who signs the letter.').max(120),
  signerTitle: z.string().trim().max(120).default(''),
  deadlineDays: z.number().int().min(1).max(30).default(7),
});

/** Writes a draft offer letter from the typed details. Nothing is sent; a person edits and sends it later. */
async function handlePOST(request: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const denied = await requireRecruiter();
  if (denied) return denied;
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) return apiError('not_found', 'Candidate not found.', 404);
  const raw = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const cleaned = Object.fromEntries(Object.entries(raw ?? {}).map(([k, v]) => [k, v === '' && (k === 'startDate') ? null : v]));
  const parsed = Body.safeParse(cleaned);
  if (!parsed.success) return apiError('invalid_input', parsed.error.issues[0]?.message ?? 'Check the details.', 400);
  const b = parsed.data;

  const db = getDb();
  const c = await db.from('candidates').select('id, job_id, full_name, jobs(title)').eq('id', id).maybeSingle();
  if (c.error) return apiError('db_error', "Couldn't load the candidate.", 500);
  if (!c.data) return apiError('not_found', 'Candidate not found.', 404);
  const row = c.data as unknown as { job_id: string; full_name: string; jobs: { title: string } | null };
  const title = row.jobs?.title ?? 'the role';
  const letter = offerLetter({ candidateName: row.full_name, title, company: b.company, compensation: b.compensation, startDate: b.startDate, signerName: b.signerName, signerTitle: b.signerTitle, deadlineDays: b.deadlineDays, today: new Date() });

  const ins = await db.from('offers').insert({ candidate_id: id, job_id: row.job_id, title, compensation: b.compensation, start_date: b.startDate, body: letter.body }).select('id').single();
  if (ins.error) return apiError('db_error', "Couldn't save the draft.", 500);
  await logEvent({ jobId: row.job_id, candidateId: id, type: 'offer.drafted', actor: 'recruiter', level: 'info', message: `Drafted an offer letter for ${row.full_name}` });
  return apiOk({ id: ins.data.id as string });
}

export const POST = withErrors(handlePOST);
