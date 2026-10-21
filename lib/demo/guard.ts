import 'server-only';
import { apiError } from '@/lib/api';
import { env } from '@/lib/env';
import { requireRecruiter } from '@/lib/security/require-recruiter';

/** Every demo route starts here: DEMO_MODE must be on (404 otherwise, as if the route did not exist) and the recruiter signed in. */
export async function demoGuard(): Promise<Response | null> {
  if (!env.DEMO_MODE) return apiError('not_found', 'Not found.', 404);
  return requireRecruiter();
}
