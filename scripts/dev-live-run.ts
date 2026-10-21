// Dev tool: builds an approved, running workflow with a 10-question assessment WITHOUT calling the AI, so the
// candidate portal and scoring can be tried quickly. Candidate links go to /tmp/portal-links.txt (name|invitation id|token).
// Run with `npm run dev:live-run` after `npm run db:seed`. Demo data only.
import { writeFileSync } from 'node:fs';
import { getScriptDb } from './db';
import { executeRun } from '../lib/executor/run';
import { buildSnapshot } from '../lib/executor/approval';
import { buildSteps } from '../lib/executor/plan-builder';
import { resolvePlan } from '../lib/ai/resolve-plan';
import { decryptToken } from '../lib/security/tokens';

const db = getScriptDb();
const JOB = '11111111-1111-4111-8111-000000000001';

const MCQ = [
  { skill: 'React', prompt: 'Which hook should you use to run code after a component renders?', options: ['useEffect', 'useMemo', 'useRef', 'useId'], correct: 0 },
  { skill: 'React', prompt: 'What does this print?\n```js\nconsole.log([1, 2, 3].map((n) => n * 2))\n```', options: ['[1, 2, 3]', '[2, 4, 6]', '6', 'undefined'], correct: 1 },
  { skill: 'APIs', prompt: 'Which HTTP status fits "the resource was created"?', options: ['200', '201', '204', '301'], correct: 1 },
  { skill: 'APIs', prompt: 'Which method is idempotent?', options: ['POST', 'PATCH', 'PUT', 'CONNECT'], correct: 2 },
  { skill: 'SQL', prompt: 'Which clause filters rows after grouping?', options: ['WHERE', 'HAVING', 'ORDER BY', 'LIMIT'], correct: 1 },
  { skill: 'SQL', prompt: 'Which join keeps every row from the left table?', options: ['INNER JOIN', 'LEFT JOIN', 'CROSS JOIN', 'SELF JOIN'], correct: 1 },
  { skill: 'Debugging', prompt: 'A service returns 500 only under load. What is the first useful step?', options: ['Restart it', 'Look at logs and metrics from the failing period', 'Rewrite it', 'Ignore it'], correct: 1 },
];
const SHORT = [
  { skill: 'SQL', prompt: 'Explain what a database index is and one case where adding one would not help.', rubric: { criteria: [{ point: 'An index speeds up lookups by avoiding a full table scan', weight: 3 }, { point: 'Mentions the cost: slower writes or extra storage', weight: 2 }, { point: 'Says low-selectivity columns or tiny tables gain little', weight: 2 }], model_answer: 'An index lets the database find rows without scanning the table. It costs storage and slows writes, and it helps little on small tables or columns with few distinct values.' } },
  { skill: 'Debugging', prompt: "A Node.js service's memory keeps growing until it crashes. Describe how you would find the cause.", rubric: { criteria: [{ point: 'Monitors memory over time and reproduces the growth', weight: 2 }, { point: 'Takes heap snapshots or uses a profiler', weight: 3 }, { point: 'Looks for retained references such as caches or event listeners', weight: 3 }], model_answer: 'Watch memory over time, take heap snapshots and compare them, and look for objects that are retained, like unbounded caches or listeners that are never removed.' } },
  { skill: 'APIs', prompt: 'Why would you make a POST endpoint idempotent, and how?', rubric: { criteria: [{ point: 'Retries or double clicks could create duplicates', weight: 2 }, { point: 'Uses an idempotency key stored on the server', weight: 3 }, { point: 'Returns the same result for a repeated key', weight: 2 }], model_answer: 'Clients retry, so the same request can arrive twice. Accept an idempotency key, store the first result, and return it again for the same key.' } },
];

void (async () => {
  const cands = (await db.from('candidates').select('id, full_name, email').eq('job_id', JOB).order('id')).data as { id: string; full_name: string; email: string | null }[];
  const { plan } = resolvePlan(
    { intent: 'create_assessment_workflow', job_id: JOB, candidate_ids: cands.map((c) => c.id),
      assessment: { title: 'Full-Stack Developer Assessment', duration_minutes: 30, question_count: 10, skills: ['React', 'APIs', 'SQL', 'Debugging'], question_types: ['mcq', 'short'], difficulty: 'mixed' },
      preview_before_invite: true, clarifications: [], guardrail_flags: [], assumptions: [], summary: 'Test workflow built without the AI' },
    { selectedJobId: JOB, jobs: [{ id: JOB, title: 'Full-Stack Developer', skills: [] }], candidates: cands.map((c) => ({ id: c.id, job_id: JOB, name: c.full_name, stage: 'applied' as const, has_email: Boolean(c.email), skills: [] })) },
    'five candidates',
  );
  const run = await db.from('workflow_runs').insert({ instruction: 'test workflow', intent: plan.intent, job_id: JOB, plan, status: 'awaiting_approval', is_demo: true }).select('id').single();
  const runId = run.data!.id as string;
  const steps = (await db.from('workflow_steps').insert(buildSteps(plan).map((s) => ({ run_id: runId, position: s.position, action: s.action, title: s.title, params: s.params, requires_approval: s.requires_approval, status: s.status }))).select('id, action, title, requires_approval')).data as { id: string; action: string; title: string; requires_approval: boolean }[];
  await db.from('workflow_steps').update({ status: 'completed', result: { message: 'Wrote 10 questions across 4 skills' } }).eq('run_id', runId).eq('action', 'generate_questions');

  const a = await db.from('assessments').insert({ run_id: runId, job_id: JOB, title: 'Full-Stack Developer Assessment', duration_minutes: 30, skills: ['React', 'APIs', 'SQL', 'Debugging'], is_demo: true, instructions: 'Answer every question. Your answers are saved as you go.' }).select('id').single();
  const aid = a.data!.id as string;
  const rows = [
    ...MCQ.map((m, i) => ({ q: { assessment_id: aid, position: i, type: 'mcq', prompt: m.prompt, options: m.options, skill: m.skill, difficulty: 'medium', max_score: 2 }, key: { correct_option: m.correct, rubric: null } })),
    ...SHORT.map((s, i) => ({ q: { assessment_id: aid, position: MCQ.length + i, type: 'short', prompt: s.prompt, options: null, skill: s.skill, difficulty: 'hard', max_score: 6 }, key: { correct_option: null, rubric: s.rubric } })),
  ];
  const qs = (await db.from('questions').insert(rows.map((r) => r.q)).select('id, position')).data as { id: string; position: number }[];
  const byPos = new Map(qs.map((q) => [q.position, q.id]));
  await db.from('question_keys').insert(rows.map((r) => ({ question_id: byPos.get(r.q.position)!, ...r.key })));

  const snapshot = buildSnapshot({ questionIds: qs.map((q) => q.id), durationMinutes: 30, recipients: cands.map((c) => ({ id: c.id, name: c.full_name, hasEmail: Boolean(c.email) })), roleTitle: 'Full-Stack Developer', steps });
  await db.from('approvals').insert({ run_id: runId, decision: 'approved', decided_by: 'recruiter', snapshot });
  await db.from('workflow_runs').update({ status: 'approved' }).eq('id', runId);
  await db.from('workflow_steps').update({ status: 'queued' }).eq('run_id', runId).eq('status', 'awaiting_approval');
  const r = await executeRun(runId);
  console.log('run', runId, 'status', r.ok ? r.data.status : r.error.message);

  const inv = (await db.from('invitations').select('id, token_encrypted, candidates(full_name)').eq('assessment_id', aid).order('candidate_id')).data as unknown as { id: string; token_encrypted: string; candidates: { full_name: string } }[];
  writeFileSync('/tmp/portal-links.txt', inv.map((i) => `${i.candidates.full_name}|${i.id}|${decryptToken(i.token_encrypted)}`).join('\n'));
  writeFileSync('/tmp/portal-run.txt', runId);
  writeFileSync('/tmp/portal-assessment.txt', aid);
  console.log('invitations', inv.length, '| questions', qs.length, '| links written to /tmp/portal-links.txt');
})();
