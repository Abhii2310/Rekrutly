import 'server-only';
import { apiOk, withErrors } from '@/lib/api';
import { runReminders } from '@/lib/reminders/service';
import { requireRecruiter } from '@/lib/security/require-recruiter';

export const maxDuration = 60;

/** The same job, for a signed-in recruiter. The War Room calls it now and then while it is open, so reminders also go out without a scheduler. */
async function handlePOST(): Promise<Response> {
  const denied = await requireRecruiter();
  if (denied) return denied;
  return apiOk(await runReminders());
}

export const POST = withErrors(handlePOST);
