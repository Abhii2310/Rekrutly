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
