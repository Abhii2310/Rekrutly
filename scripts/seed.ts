import { getScriptDb, loadEnv } from './db';
import { seedDemo } from '../lib/demo/seed';

const env = loadEnv();
const db = getScriptDb(env);

async function main(): Promise<void> {
  const result = await seedDemo(db, { candidateEmail: env.DEMO_CANDIDATE_EMAIL ?? null, candidateWhatsapp: env.DEMO_CANDIDATE_WHATSAPP ?? null });
  console.table(result.summary);
  console.log(`Seeded ${result.jobs} jobs and ${result.candidates} candidates.`);
  if (process.argv.includes('--with-history')) {
    // Imported here so a plain reset never needs the server-only token helper.
    const { seedHistory } = await import('../lib/demo/history');
    const { createInvitationToken } = await import('../lib/security/tokens');
    const h = await seedHistory(db, { makeToken: () => { const t = createInvitationToken(); return { hash: t.hash, encrypted: t.encrypted }; } });
    console.log(`Seeded history: a closed assessment with ${h.submissions} simulated submissions.`);
  }
}

main().catch((e: unknown) => {
  console.error('Seed failed:', e instanceof Error ? e.message : e);
  process.exit(1);
});
