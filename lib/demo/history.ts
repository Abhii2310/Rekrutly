import type { SupabaseClient } from '@supabase/supabase-js';
import { aggregate } from '../scoring/aggregate';
import { cid, jid } from './ids';

const HISTORY_INSTRUCTION = 'Demo history: Backend Engineer (Go) screening assessment';
const TITLE = 'Backend Engineer (Go) screening';
const DAY = 24 * 60 * 60 * 1000;

type Q = { skill: string; difficulty: 'easy' | 'medium' | 'hard'; prompt: string; options: string[]; correct: number; explanation: string };

// Eight multiple-choice questions, written by hand. History needs no AI and no answer is invented by a model.
const QUESTIONS: Q[] = [
  { skill: 'Go', difficulty: 'easy', prompt: 'What does a goroutine leak usually mean?', options: ['A goroutine that can never finish and keeps its memory', 'A variable that was declared but never used', 'A panic that was recovered too early', 'A channel that was closed twice'], correct: 0, explanation: 'A blocked goroutine that nothing can wake stays alive and holds memory.' },
  { skill: 'Go', difficulty: 'medium', prompt: 'Which statement about a nil map in Go is true?', options: ['Reading from it is safe, writing to it panics', 'Reading and writing both panic', 'Reading and writing are both safe', 'It is automatically created on first write'], correct: 0, explanation: 'Reads from a nil map return the zero value; writes panic.' },
  { skill: 'PostgreSQL', difficulty: 'easy', prompt: 'Which index type is the default in PostgreSQL?', options: ['B-tree', 'Hash', 'GIN', 'BRIN'], correct: 0, explanation: 'CREATE INDEX builds a B-tree unless you ask for another type.' },
  { skill: 'PostgreSQL', difficulty: 'hard', prompt: 'Two transactions update the same row at the same time. What happens in PostgreSQL?', options: ['The second waits until the first commits or rolls back', 'Both succeed and the last write wins silently', 'The second one is rejected immediately', 'The row is copied so both updates apply'], correct: 0, explanation: 'Row locks make the second update wait for the first transaction to end.' },
  { skill: 'Distributed systems', difficulty: 'medium', prompt: 'Why add an idempotency key to a retried request?', options: ['So repeating the request does not repeat its effect', 'So the request is encrypted in transit', 'So the server can skip authentication', 'So requests arrive in order'], correct: 0, explanation: 'The server can recognise the repeat and return the first result.' },
  { skill: 'Distributed systems', difficulty: 'hard', prompt: 'In the CAP theorem, what must a system give up during a network partition?', options: ['Either consistency or availability', 'Both partition tolerance and availability', 'Durability', 'Latency'], correct: 0, explanation: 'During a partition you choose between consistency and availability.' },
  { skill: 'Kubernetes', difficulty: 'easy', prompt: 'What does a Kubernetes readiness probe decide?', options: ['Whether a pod should receive traffic', 'Whether the node has enough memory', 'Whether the container image is signed', 'Whether the pod should be deleted'], correct: 0, explanation: 'Pods that fail readiness are removed from service endpoints.' },
  { skill: 'Kubernetes', difficulty: 'medium', prompt: 'Which object keeps a set number of identical pods running?', options: ['Deployment (through a ReplicaSet)', 'ConfigMap', 'Ingress', 'ServiceAccount'], correct: 0, explanation: 'A Deployment manages a ReplicaSet that keeps the pod count steady.' },
];

// Who answered which question wrongly (indexes). Different on purpose, so the skills differ between the three.
const PEOPLE = [
  { n: 12, name: 'Vikram', full: 'Vikram Choudhury', wrong: [1, 5], daysAgo: 6 },
  { n: 13, name: 'Nandini', full: 'Nandini Rao', wrong: [3, 4, 7], daysAgo: 5 },
  { n: 14, name: 'Faisal', full: 'Faisal Ahmed', wrong: [5], daysAgo: 4 },
];

export type HistoryOptions = {
  /** Creates a link token. The caller supplies it because the helper that makes tokens is server-only. */
  makeToken: () => { hash: string; encrypted: string };
};

async function run(label: string, p: PromiseLike<{ error: { message: string } | null }>): Promise<void> {
  const { error } = await p;
  if (error) throw new Error(`${label}: ${error.message}`);
}

/**
 * Creates one closed assessment for the Backend Engineer (Go) job with three simulated submissions, so Analytics has
 * history. Everything is flagged `is_simulated`. Safe to run again: it replaces the previous history first.
 */
export async function seedHistory(db: SupabaseClient, options: HistoryOptions): Promise<{ assessmentId: string; submissions: number }> {
  // Replace an earlier copy.
  await run('remove old history assessment', db.from('assessments').delete().eq('job_id', jid(3)).eq('title', TITLE).eq('is_demo', true));
  await run('remove old history run', db.from('workflow_runs').delete().eq('instruction', HISTORY_INSTRUCTION).eq('is_demo', true));

  const now = Date.now();
  const iso = (ms: number): string => new Date(ms).toISOString();
  const skills = [...new Set(QUESTIONS.map((q) => q.skill))];

  const runIns = await db.from('workflow_runs').insert({
    instruction: HISTORY_INSTRUCTION, intent: 'create_assessment_workflow', job_id: jid(3), status: 'completed', is_demo: true,
    approved_at: iso(now - 8 * DAY), completed_at: iso(now - 3 * DAY),
    plan: {
      intent: 'create_assessment_workflow', job: { id: jid(3), title: 'Backend Engineer (Go)' },
      candidates: PEOPLE.map((p) => ({ id: cid(p.n), name: p.full, has_email: true })),
      assessment: { title: TITLE, duration_minutes: 25, question_count: QUESTIONS.length, skills, question_types: ['mcq'], difficulty: 'mixed' },
      preview_before_invite: true, summary: 'Screening assessment for the Backend Engineer (Go) role. Simulated history for the demo.',
      assumptions: [], guardrail_flags: [], clarifications: [],
    },
  }).select('id').single();
  if (runIns.error) throw new Error(`history run: ${runIns.error.message}`);
  const runId = runIns.data.id as string;

  const stepTitles: [string, string][] = [
    ['generate_questions', 'Write 8 questions'], ['create_assessment', 'Create the assessment'], ['create_invitations', 'Create 3 candidate links'],
    ['send_invitations', 'Send invitations by email'], ['track_submissions', 'Track submissions'], ['score_and_report', 'Score and prepare reports'],
  ];
  await run('history steps', db.from('workflow_steps').insert(stepTitles.map(([action, title], position) => ({
    run_id: runId, position, action, title, status: 'completed', result: { message: 'Done. Simulated history.' },
  }))));

  const aIns = await db.from('assessments').insert({
    job_id: jid(3), run_id: runId, title: TITLE, duration_minutes: 25, skills, status: 'closed', is_demo: true,
    instructions: 'Answer every question. Your answers are saved as you go.', published_at: iso(now - 8 * DAY),
  }).select('id').single();
  if (aIns.error) throw new Error(`history assessment: ${aIns.error.message}`);
  const assessmentId = aIns.data.id as string;

  const qIns = await db.from('questions').insert(QUESTIONS.map((q, position) => ({
    assessment_id: assessmentId, position, type: 'mcq', prompt: q.prompt, options: q.options, skill: q.skill, difficulty: q.difficulty,
    max_score: 2, ai_generated: false,
  }))).select('id, position');
  if (qIns.error) throw new Error(`history questions: ${qIns.error.message}`);
  const qIds = (qIns.data as { id: string; position: number }[]).sort((a, b) => a.position - b.position).map((q) => q.id);
  await run('history keys', db.from('question_keys').insert(QUESTIONS.map((q, i) => ({ question_id: qIds[i] as string, correct_option: q.correct, rubric: null, explanation: q.explanation }))));

  const aggQuestions = QUESTIONS.map((q, i) => ({ id: qIds[i] as string, skill: q.skill, type: 'mcq' as const, max_score: 2 }));

  for (const p of PEOPLE) {
    const token = options.makeToken();
    const started = now - p.daysAgo * DAY;
    const submitted = started + 17 * 60_000;
    const inv = await db.from('invitations').insert({
      assessment_id: assessmentId, candidate_id: cid(p.n), token_hash: token.hash, token_encrypted: token.encrypted, status: 'submitted',
      delivery_status: 'unconfigured', created_at: iso(started - 3 * 60 * 60_000), expires_at: iso(started + 7 * DAY), consent_at: iso(started), opened_at: iso(started - 60_000),
      started_at: iso(started), deadline_at: iso(started + 25 * 60_000), submitted_at: iso(submitted), current_question: QUESTIONS.length, last_activity_at: iso(submitted),
    }).select('id').single();
    if (inv.error) throw new Error(`history invitation: ${inv.error.message}`);
    const invitationId = inv.data.id as string;

    const picks = QUESTIONS.map((q, i) => (p.wrong.includes(i) ? (q.correct + 1) % q.options.length : q.correct));
    await run('history answers', db.from('answers').insert(QUESTIONS.map((_, i) => ({
      invitation_id: invitationId, question_id: qIds[i] as string, selected_option: picks[i] as number, saved_at: iso(started + (i + 1) * 100_000),
    }))));

    const scores = QUESTIONS.map((q, i) => {
      const right = picks[i] === q.correct;
      return { question_id: qIds[i] as string, method: 'auto' as const, score: right ? 2 : 0, max_score: 2, overridden_score: null as number | null, is_correct: right, unanswered: false };
    });
    const agg = aggregate(aggQuestions, scores);

    const strong = agg.skill_breakdown.filter((s) => s.percent === 100).map((s) => s.skill);
    const weak = agg.skill_breakdown.filter((s) => s.percent < 100);
    const report = {
      summary: `Simulated demo submission. ${p.name} scored ${agg.final.score} of ${agg.final.max} on the multiple-choice questions${weak.length ? `, with gaps in ${weak.map((w) => w.skill).join(' and ')}` : ''}.`,
      strengths: strong.slice(0, 4).map((skill) => ({ skill, evidence: `${skill}, multiple choice: every question was answered correctly.` })),
      gaps: weak.slice(0, 4).map((w) => ({ skill: w.skill, evidence: `${w.skill}, multiple choice: ${w.score} of ${w.max} points.` })),
      interview_questions: [...weak, ...agg.skill_breakdown].slice(0, 3).map((s) => ({
        skill: s.skill, question: `Walk me through a time you worked with ${s.skill} in production and what went wrong.`,
        what_good_looks_like: `A specific example, the cause found, and what was changed afterwards for ${s.skill}.`,
      })),
      missing_evidence: ['No written answers in this assessment.'],
    };

    const sub = await db.from('submissions').insert({
      invitation_id: invitationId, submitted_at: iso(submitted), objective_score: agg.objective.score, objective_max: agg.objective.max,
      final_score: agg.final.score, final_max: agg.final.max, skill_breakdown: agg.skill_breakdown, scoring_status: 'scored',
      report, report_status: 'ready', is_simulated: true,
    }).select('id').single();
    if (sub.error) throw new Error(`history submission: ${sub.error.message}`);
    await run('history scores', db.from('question_scores').insert(scores.map((s) => ({
      submission_id: sub.data.id as string, question_id: s.question_id, method: 'auto', score: s.score, max_score: s.max_score, is_correct: s.is_correct, unanswered: false,
    }))));
    await run('history stage', db.from('candidates').update({ stage: 'assessment_submitted' }).eq('id', cid(p.n)).in('stage', ['applied', 'assessment_invited']));
  }

  await run('history receipt', db.from('workflow_events').insert({
    run_id: runId, job_id: jid(3), type: 'demo.simulated', actor: 'system', level: 'info', is_simulated: true,
    message: `Seeded demo history: a closed assessment with ${PEOPLE.length} simulated submissions`, data: { assessmentId },
  }));
  return { assessmentId, submissions: PEOPLE.length };
}
