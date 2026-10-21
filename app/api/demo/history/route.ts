import 'server-only';
import { apiError, apiOk, withErrors } from '@/lib/api';
import { demoGuard } from '@/lib/demo/guard';
import { seedHistory } from '@/lib/demo/history';
import { getDb } from '@/lib/db/server';
import { createInvitationToken } from '@/lib/security/tokens';

export const maxDuration = 60;

/** A closed assessment on the Backend Engineer (Go) job with three simulated submissions, so Analytics has history. */
async function handlePOST(): Promise<Response> {
  const denied = await demoGuard();
  if (denied) return denied;
  try {
    const h = await seedHistory(getDb(), { makeToken: () => { const t = createInvitationToken(); return { hash: t.hash, encrypted: t.encrypted }; } });
    return apiOk(h);
  } catch (e) {
    console.error('demo history failed:', e instanceof Error ? e.message : e);
    return apiError('history_failed', "Couldn't add the demo history. Reset the demo data first, then try again.", 500);
  }
}

export const POST = withErrors(handlePOST);
