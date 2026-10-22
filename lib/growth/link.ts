import 'server-only';
import { getDb } from '@/lib/db/server';
import { env } from '@/lib/env';
import { decryptToken } from '@/lib/security/tokens';

/** The candidate's private report link, from their latest submitted test. Null when they never submitted one. */
export async function growthLink(candidateId: string): Promise<string | null> {
  const q = await getDb().from('invitations').select('token_encrypted').eq('candidate_id', candidateId).eq('status', 'submitted').order('submitted_at', { ascending: false }).limit(1).maybeSingle();
  if (q.error || !q.data) return null;
  try {
    return `${env.APP_URL}/a/${decryptToken(q.data.token_encrypted as string)}/growth`;
  } catch {
    return null;
  }
}
