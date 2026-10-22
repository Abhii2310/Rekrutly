import { getScriptDb, loadEnv } from './db';

/**
 * npm run proctor:setup
 * Checks that migration 0002 was applied and creates the private storage bucket for recordings.
 */
const BUCKET = 'proctoring';

async function main(): Promise<void> {
  const db = getScriptDb(loadEnv());
  const checks: [string, PromiseLike<{ error: { message: string } | null }>][] = [
    ['assessments.proctored', db.from('assessments').select('proctored').limit(1)],
    ['invitations.proctor_consent_at, last_snapshot_at', db.from('invitations').select('proctor_consent_at, last_snapshot_at').limit(1)],
    ['integrity_signals.detail, video_ms', db.from('integrity_signals').select('detail, video_ms').limit(1)],
    ['proctor_segments table', db.from('proctor_segments').select('id').limit(1)],
  ];
  let ok = true;
  for (const [name, q] of checks) {
    const { error } = await q;
    console.log(`${error ? 'MISSING' : 'ok     '} ${name}${error ? `  (${error.message})` : ''}`);
    if (error) ok = false;
  }
  if (!ok) {
    console.error('\nRun supabase/migrations/0002_proctoring.sql in the Supabase SQL Editor, then run this again.');
    process.exit(1);
  }

  // Migration 0003: the type list must accept the eye and voice signals. A check failure (23514) means it does not;
  // a foreign-key failure (23503) means the type was accepted and only the made-up invitation was refused.
  const probe = await db.from('integrity_signals').insert({ invitation_id: '00000000-0000-4000-8000-000000000000', type: 'voice_detected' });
  if (probe.error?.code === '23514') {
    console.error('MISSING signal types eyes_away, voice_detected\nRun supabase/migrations/0003_gaze_voice.sql in the Supabase SQL Editor, then run this again.');
    process.exit(1);
  }
  console.log('ok      signal types eyes_away, voice_detected');

  // Migration 0004: resume match, shortlist, interviews, offers.
  const hr: [string, PromiseLike<{ error: { message: string } | null }>][] = [
    ['candidates.resume_text, resume_match, shortlisted', db.from('candidates').select('resume_text, resume_match, shortlisted').limit(1)],
    ['interviews table', db.from('interviews').select('id').limit(1)],
    ['offers table', db.from('offers').select('id').limit(1)],
  ];
  let hrOk = true;
  for (const [name, q] of hr) {
    const { error } = await q;
    console.log(`${error ? 'MISSING' : 'ok     '} ${name}${error ? `  (${error.message})` : ''}`);
    if (error) hrOk = false;
  }
  if (!hrOk) {
    console.error('\nRun supabase/migrations/0004_hr_flow.sql in the Supabase SQL Editor, then run this again.');
    process.exit(1);
  }

  // Migration 0005: rejection emails, reminders, interview slots, offer replies.
  const pipe: [string, PromiseLike<{ error: { message: string } | null }>][] = [
    ['candidates.rejection_emailed_at', db.from('candidates').select('rejection_emailed_at').limit(1)],
    ['invitations.reminder_sent_at', db.from('invitations').select('reminder_sent_at').limit(1)],
    ['interviews.reminder_sent_at, proposed_slots', db.from('interviews').select('reminder_sent_at, proposed_slots').limit(1)],
    ['offers.token_hash, token_encrypted, response, responded_at', db.from('offers').select('token_hash, token_encrypted, response, responded_at').limit(1)],
  ];
  let pipeOk = true;
  for (const [name, q] of pipe) {
    const { error } = await q;
    console.log(`${error ? 'MISSING' : 'ok     '} ${name}${error ? `  (${error.message})` : ''}`);
    if (error) pipeOk = false;
  }
  if (!pipeOk) {
    console.error('\nRun supabase/migrations/0005_pipeline.sql in the Supabase SQL Editor, then run this again.');
    process.exit(1);
  }

  // Migration 0006: the AI interview.
  const ai: [string, PromiseLike<{ error: { message: string } | null }>][] = [
    ['assessments.ai_interview', db.from('assessments').select('ai_interview').limit(1)],
    ['ai_interviews table', db.from('ai_interviews').select('id, plan, turns, summary').limit(1)],
  ];
  let aiOk = true;
  for (const [name, q] of ai) {
    const { error } = await q;
    console.log(`${error ? 'MISSING' : 'ok     '} ${name}${error ? `  (${error.message})` : ''}`);
    if (error) aiOk = false;
  }
  if (!aiOk) {
    console.error('\nRun supabase/migrations/0006_ai_interview.sql in the Supabase SQL Editor, then run this again.');
    process.exit(1);
  }

  // Migration 0007: the AI-collaboration task.
  const task: [string, PromiseLike<{ error: { message: string } | null }>][] = [
    ['assessments.ai_task', db.from('assessments').select('ai_task').limit(1)],
    ['ai_tasks table', db.from('ai_tasks').select('id, task, chat, deliverable, metrics, review').limit(1)],
  ];
  let taskOk = true;
  for (const [name, q] of task) {
    const { error } = await q;
    console.log(`${error ? 'MISSING' : 'ok     '} ${name}${error ? `  (${error.message})` : ''}`);
    if (error) taskOk = false;
  }
  if (!taskOk) {
    console.error('\nRun supabase/migrations/0007_ai_task.sql in the Supabase SQL Editor, then run this again.');
    process.exit(1);
  }

  const list = await db.storage.listBuckets();
  if (list.error) throw new Error(list.error.message);
  if (list.data.some((b) => b.name === BUCKET)) {
    console.log(`ok      bucket "${BUCKET}" already exists`);
  } else {
    const made = await db.storage.createBucket(BUCKET, { public: false, fileSizeLimit: 25 * 1024 * 1024 });
    if (made.error) throw new Error(made.error.message);
    console.log(`created bucket "${BUCKET}" (private, 25 MB per file)`);
  }
}

main().catch((e: unknown) => {
  console.error('Setup failed:', e instanceof Error ? e.message : e);
  process.exit(1);
});
