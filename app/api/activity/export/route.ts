import 'server-only';
import { apiError, withErrors } from '@/lib/api';
import { parseGroup } from '@/lib/activity';
import { toCsv } from '@/lib/csv';
import { exportActivity } from '@/lib/db/queries/activity';
import { requireRecruiter } from '@/lib/security/require-recruiter';

export const dynamic = 'force-dynamic';

/** The receipts as a CSV file, for an audit. Same filters as the Activity page. */
async function handleGET(request: Request): Promise<Response> {
  const denied = await requireRecruiter();
  if (denied) return denied;
  const group = parseGroup(new URL(request.url).searchParams.get('group') ?? undefined);
  const res = await exportActivity(group);
  if (!res.ok) return apiError(res.error.code, res.error.message, 500);
  const csv = toCsv(
    ['Time (UTC)', 'Who', 'Type', 'Level', 'What happened', 'Candidate', 'Simulated'],
    res.data.map((r) => [r.created_at, r.actor, r.type, r.level, r.message, r.candidate, r.is_simulated ? 'yes' : 'no']),
  );
  return new Response(csv, {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="rekrutly-activity-${group}.csv"`,
      'cache-control': 'no-store',
    },
  });
}

export const GET = withErrors(handleGET);
