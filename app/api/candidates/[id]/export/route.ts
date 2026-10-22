import 'server-only';
import { z } from 'zod';
import { apiError, withErrors } from '@/lib/api';
import { getDb } from '@/lib/db/server';
import { logEvent } from '@/lib/events';
import { requireRecruiter } from '@/lib/security/require-recruiter';

export const dynamic = 'force-dynamic';

/**
 * Everything Rekrutly holds about one candidate, as a JSON file: the right to access your data. Answer keys, rubrics and
 * link tokens are never included. This covers the resume, match, interviews, AI interview transcript, offers and recording details too.
 */
async function handleGET(_request: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const denied = await requireRecruiter();
  if (denied) return denied;
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) return apiError('not_found', 'Candidate not found.', 404);

  const db = getDb();
  const cand = await db.from('candidates').select('id, job_id, full_name, email, phone, current_title, current_company, years_experience, location, skills, resume_summary, resume_text, resume_match, shortlisted, rejection_emailed_at, source, stage, is_demo, created_at, updated_at').eq('id', id).maybeSingle();
  if (cand.error) return apiError('db_error', "Couldn't load the candidate.", 500);
  if (!cand.data) return apiError('not_found', 'Candidate not found.', 404);

  const inv = await db.from('invitations').select('id, assessment_id, status, delivery_status, expires_at, consent_at, opened_at, started_at, deadline_at, submitted_at, assessments(title)').eq('candidate_id', id);
  if (inv.error) return apiError('db_error', "Couldn't load the assessments.", 500);
  const invitations = inv.data as unknown as { id: string }[];
  const ids = invitations.map((i) => i.id);

  const [answers, subs, signals, tasks, events, interviews, offers, aiInterviews, aiTasks, segments] = await Promise.all([
    ids.length ? db.from('answers').select('invitation_id, selected_option, text_answer, saved_at, questions(prompt, type, skill)').in('invitation_id', ids) : Promise.resolve({ data: [], error: null }),
    ids.length ? db.from('submissions').select('id, invitation_id, submitted_at, auto_submitted, objective_score, objective_max, ai_suggested_score, ai_suggested_max, final_score, final_max, skill_breakdown, report, is_simulated, question_scores(score, max_score, method, reasoning, evidence_quote, confidence, overridden_score, override_reason, questions(prompt))').in('invitation_id', ids) : Promise.resolve({ data: [], error: null }),
    ids.length ? db.from('integrity_signals').select('invitation_id, type, occurred_at, video_ms, detail').in('invitation_id', ids) : Promise.resolve({ data: [], error: null }),
    db.from('tasks').select('type, title, detail, status, draft, created_at').eq('candidate_id', id),
    db.from('workflow_events').select('type, actor, message, created_at').eq('candidate_id', id).order('id'),
    db.from('interviews').select('scheduled_at, duration_minutes, status, proposed_slots, notes, scorecard, created_at').eq('candidate_id', id).order('scheduled_at'),
    db.from('offers').select('title, compensation, start_date, body, status, sent_at, response, responded_at, created_at').eq('candidate_id', id).order('created_at'),
    ids.length ? db.from('ai_interviews').select('status, plan, turns, summary, started_at, completed_at').in('invitation_id', ids) : Promise.resolve({ data: [], error: null }),
    ids.length ? db.from('ai_tasks').select('status, task, chat, deliverable, metrics, review, started_at, completed_at').in('invitation_id', ids) : Promise.resolve({ data: [], error: null }),
    ids.length ? db.from('proctor_segments').select('seq, started_ms, duration_ms, bytes, created_at').in('invitation_id', ids).order('seq') : Promise.resolve({ data: [], error: null }),
  ]);
  const bad = [answers, subs, signals, tasks, events, interviews, offers, aiInterviews, aiTasks, segments].find((r) => r.error);
  if (bad?.error) return apiError('db_error', "Couldn't collect the data.", 500);

  await logEvent({
    jobId: cand.data.job_id as string, type: 'candidate.exported', actor: 'recruiter', level: 'info',
    message: 'Exported a candidate\'s data', data: { candidateRef: id.slice(0, 8) },
  });
  const body = { exported_at: new Date().toISOString(), candidate: cand.data, invitations, answers: answers.data, submissions: subs.data, integrity_signals: signals.data, camera_recording: { pieces: segments.data, note: 'The video files themselves are held in private storage and are deleted with the candidate. Ask the hiring team for a copy.' }, ai_interviews: aiInterviews.data, ai_work_tasks: aiTasks.data, interviews: interviews.data, offers: offers.data, tasks: tasks.data, activity: events.data };
  return new Response(JSON.stringify(body, null, 2), {
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'content-disposition': `attachment; filename="candidate-data-${id.slice(0, 8)}.json"`,
      'cache-control': 'no-store',
    },
  });
}

export const GET = withErrors(handleGET);
