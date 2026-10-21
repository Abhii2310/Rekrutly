import type { SupabaseClient } from '@supabase/supabase-js';
import type { CandidateInsert } from '../db/types';
import { DEMO_JOBS, DEMO_SEEDS } from './data';
import { cid, jid } from './ids';

export type SeedOptions = {
  /** Aarav's email, so the demo invitation reaches a real inbox. */
  candidateEmail?: string | null;
  /** The presenter's WhatsApp number, put on Aarav and Kabir so "Open in WhatsApp" works in the demo. */
  candidateWhatsapp?: string | null;
  /** Write the "Seeded ..." receipt. The Demo Director writes its own "Reset" receipt instead, so it turns this off. */
  logSeed?: boolean;
};

export type SeedResult = { jobs: number; candidates: number; summary: { job: string; candidates: number; stages: string }[] };

async function run(label: string, p: PromiseLike<{ error: { message: string } | null }>): Promise<void> {
  const { error } = await p;
  if (error) throw new Error(`${label}: ${error.message}`);
}

/**
 * Resets the demo data. Shared by `npm run db:seed` and the Demo Director, so it takes a client and imports nothing
 * server-only. It deletes every demo run, assessment, invitation and submission, including ones created by hand in
 * DEMO_MODE, then recreates the jobs and candidates with the same fixed IDs so saved fallbacks stay valid.
 * Rows with is_demo = false are never touched.
 */
export async function seedDemo(db: SupabaseClient, options: SeedOptions = {}): Promise<SeedResult> {
  await run('delete demo runs', db.from('workflow_runs').delete().eq('is_demo', true));
  // Old seed receipts have no run or job, so they would pile up on the Overview. Remove only those.
  await run('delete old seed receipts', db.from('workflow_events').delete().in('type', ['system.seeded', 'demo.reset']));
  await run('delete demo jobs', db.from('jobs').delete().eq('is_demo', true));
  await run('insert jobs', db.from('jobs').insert(DEMO_JOBS));

  const candidates: CandidateInsert[] = DEMO_SEEDS.map((s) => ({
    id: cid(s.n),
    job_id: jid(s.job),
    full_name: s.name,
    email: s.n === 1 ? (options.candidateEmail ?? s.email ?? null) : (s.email ?? null),
    // The presenter's own number goes on Aarav (who takes the test live) and Kabir (who gets the demo nudge).
    phone: s.n === 1 || s.n === 3 ? (options.candidateWhatsapp ?? null) : null,
    current_title: s.title,
    current_company: s.company,
    years_experience: s.yrs,
    location: s.loc,
    skills: s.skills,
    resume_summary: s.summary,
    source: 'Demo data',
    stage: s.stage,
    is_demo: true,
  }));
  await run('insert candidates', db.from('candidates').insert(candidates));

  const summary = DEMO_JOBS.map((j) => {
    const mine = candidates.filter((c) => c.job_id === j.id);
    const counts = mine.reduce<Record<string, number>>((a, c) => ({ ...a, [c.stage ?? 'applied']: (a[c.stage ?? 'applied'] ?? 0) + 1 }), {});
    return { job: j.title, candidates: mine.length, stages: Object.entries(counts).map(([k, v]) => `${v} ${k}`).join(', ') };
  });

  if (options.logSeed !== false) await run('log event', db.from('workflow_events').insert({
    type: 'system.seeded', actor: 'system', level: 'success',
    message: `Seeded ${DEMO_JOBS.length} demo jobs and ${candidates.length} candidates`,
    data: { jobs: DEMO_JOBS.length, candidates: candidates.length },
  }));
  return { jobs: DEMO_JOBS.length, candidates: candidates.length, summary };
}
