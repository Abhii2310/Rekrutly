import 'server-only';
import { apiError } from '@/lib/api';
import { resolveInvitation, type ResolvedInvitation } from './service';

/**
 * Every candidate route starts here. An unknown or malformed token gets the same 404 whether or not it ever
 * existed, so the response never reveals anything about other links.
 */
export async function withInvitation(token: string): Promise<{ inv: ResolvedInvitation } | { response: Response }> {
  const res = await resolveInvitation(token);
  if (!res.ok) return { response: apiError('server_error', 'Something went wrong. Try again in a moment.', 500) };
  if (!res.data) return { response: apiError('invalid_link', "This link isn't valid.", 404) };
  return { inv: res.data };
}
