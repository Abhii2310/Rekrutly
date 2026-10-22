import 'server-only';
import { getDb } from '@/lib/db/server';
import { err, ok, type Result } from '@/lib/result';

export const BUCKET = 'proctoring';
/** A 30-second piece at a low bit rate is about 1 MB; this keeps a bad client from filling storage. */
export const MAX_SEGMENT_BYTES = 6 * 1024 * 1024;
export const MAX_SNAPSHOT_BYTES = 200 * 1024;

const segmentPath = (invitationId: string, seq: number, ext: string): string => `${invitationId}/seg-${String(seq).padStart(4, '0')}.${ext}`;
export const snapshotPath = (invitationId: string): string => `${invitationId}/latest.jpg`;

export async function saveSegment(
  invitationId: string, seq: number, startedMs: number, durationMs: number, body: ArrayBuffer, contentType: string,
): Promise<Result<{ seq: number }>> {
  const ext = contentType.includes('mp4') ? 'mp4' : 'webm';
  const path = segmentPath(invitationId, seq, ext);
  const db = getDb();
  const up = await db.storage.from(BUCKET).upload(path, body, { contentType, upsert: true });
  if (up.error) return err('storage_error', "Couldn't store the recording.", up.error.message);
  const row = await db.from('proctor_segments').upsert(
    { invitation_id: invitationId, seq, storage_path: path, started_ms: startedMs, duration_ms: durationMs, bytes: body.byteLength },
    { onConflict: 'invitation_id,seq' },
  );
  if (row.error) return err('db_error', "Couldn't save the recording.", row.error.message);
  return ok({ seq });
}

/** One latest picture per candidate, overwritten each time. It is only for the live War Room thumbnail. */
export async function saveSnapshot(invitationId: string, body: ArrayBuffer): Promise<Result<true>> {
  const db = getDb();
  const up = await db.storage.from(BUCKET).upload(snapshotPath(invitationId), body, { contentType: 'image/jpeg', upsert: true });
  if (up.error) return err('storage_error', "Couldn't store the picture.", up.error.message);
  await db.from('invitations').update({ last_snapshot_at: new Date().toISOString() }).eq('id', invitationId);
  return ok(true);
}

export async function readSnapshot(invitationId: string): Promise<ArrayBuffer | null> {
  const dl = await getDb().storage.from(BUCKET).download(snapshotPath(invitationId));
  return dl.error || !dl.data ? null : await dl.data.arrayBuffer();
}

export type SegmentView = { seq: number; startedMs: number; durationMs: number; url: string };

/** Short-lived signed links, made only for a signed-in recruiter. */
export async function listSegments(invitationId: string): Promise<Result<SegmentView[]>> {
  const db = getDb();
  const rows = await db.from('proctor_segments').select('seq, storage_path, started_ms, duration_ms').eq('invitation_id', invitationId).order('seq');
  if (rows.error) return err('db_error', "Couldn't load the recording.", rows.error.message);
  const list = rows.data as { seq: number; storage_path: string; started_ms: number; duration_ms: number }[];
  if (list.length === 0) return ok([]);
  const signed = await db.storage.from(BUCKET).createSignedUrls(list.map((r) => r.storage_path), 3600);
  if (signed.error || !signed.data) return err('storage_error', "Couldn't open the recording.", signed.error?.message);
  const byPath = new Map(signed.data.map((s) => [s.path, s.signedUrl]));
  return ok(list.flatMap((r) => {
    const url = byPath.get(r.storage_path);
    return url ? [{ seq: r.seq, startedMs: r.started_ms, durationMs: r.duration_ms, url }] : [];
  }));
}

/** Removes every file kept for these invitations. Used when a candidate's data is deleted. */
export async function deleteRecordings(invitationIds: string[]): Promise<void> {
  const db = getDb();
  for (const id of invitationIds) {
    const listed = await db.storage.from(BUCKET).list(id, { limit: 1000 });
    const names = (listed.data ?? []).map((f) => `${id}/${f.name}`);
    if (names.length > 0) await db.storage.from(BUCKET).remove(names);
  }
}
