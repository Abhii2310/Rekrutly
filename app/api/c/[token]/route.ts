import 'server-only';
import { after } from 'next/server';
import { apiOk, withErrors } from '@/lib/api';
import { withInvitation } from '@/lib/portal/http';
import { markOpened, questionCount } from '@/lib/portal/service';
import { getPortalState, toIso } from '@/lib/portal/state';
import { getDb } from '@/lib/db/server';
import { runPostSubmitPipeline } from '@/lib/scoring/pipeline';
import { afterSubmit, submitAssessment } from '@/lib/scoring/submit';

export const dynamic = 'force-dynamic';

async function handleGET(_request: Request, { params }: { params: Promise<{ token: string }> }): Promise<Response> {
  const { token } = await params;
  const found = await withInvitation(token);
  if ('response' in found) return found.response;
  let { inv } = found;
  const now = new Date();
  let state = getPortalState(inv, now);
  let autoSubmitted = false;

  // The deadline passed and nothing was submitted (the tab was closed): finish it from the saved answers.
  if (state === 'time_up') {
    const done = await submitAssessment(inv, now);
    if (done.ok) {
      const finished = inv
      after(async () => {
        await afterSubmit(finished, done.data)
        await runPostSubmitPipeline(done.data.submissionId)
      })
      autoSubmitted = true;
      inv = { ...inv, status: 'submitted', submitted_at: done.data.submittedAt };
    } else if (done.error.code !== 'already_submitted') {
      return apiOk({ state: 'time_up', serverNow: now.toISOString(), firstName: inv.firstName });
    }
    state = 'submitted';
  }
  if (state === 'submitted' && !autoSubmitted) {
    const sub = await getDb().from('submissions').select('auto_submitted').eq('invitation_id', inv.id).maybeSingle();
    autoSubmitted = Boolean(sub.data?.auto_submitted);
  }

  if (state === 'ready') await markOpened(inv);

  const showTest = state === 'ready' || state === 'in_progress';
  return apiOk({
    state,
    serverNow: now.toISOString(),
    firstName: inv.firstName,
    // Nothing about the test itself is shown to a link that is expired, revoked or finished.
    jobTitle: showTest ? inv.jobTitle : null,
    assessmentTitle: showTest ? inv.assessment.title : null,
    durationMinutes: showTest ? inv.assessment.duration_minutes : null,
    questionCount: showTest ? await questionCount(inv.assessment_id) : null,
    proctored: showTest ? inv.assessment.proctored : false,
    instructions: state === 'ready' ? inv.assessment.instructions : null,
    deadlineAt: state === 'in_progress' ? toIso(inv.deadline_at) : null,
    submittedAt: state === 'submitted' ? toIso(inv.submitted_at) : null,
    autoSubmitted,
  });
}

export const GET = withErrors(handleGET);
