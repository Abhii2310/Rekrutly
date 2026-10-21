import { getScriptDb } from './db';

const TABLES = [
  'jobs', 'candidates', 'workflow_runs', 'workflow_steps', 'approvals',
  'assessments', 'questions', 'question_keys', 'invitations', 'answers',
  'submissions', 'question_scores', 'integrity_signals', 'tasks', 'workflow_events',
] as const;

async function main(): Promise<void> {
  const db = getScriptDb();
  let missing = 0;
  for (const table of TABLES) {
    const { error } = await db.from(table).select('*').limit(1);
    if (error) {
      missing++;
      console.log(`MISSING  ${table}  (${error.message})`);
    } else {
      console.log(`OK       ${table}`);
    }
  }
  if (missing > 0) {
    console.error('Run supabase/migrations/0001_init.sql in the Supabase SQL Editor, then rerun npm run db:check');
    process.exit(1);
  }
}

void main();
