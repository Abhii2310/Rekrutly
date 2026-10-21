import { describe, expect, it } from 'vitest';
import { resolvePlan, statedCandidateCount, statedDuration, statedQuestionCount, type PlannerContext } from '@/lib/ai/resolve-plan';
import { buildSteps } from '@/lib/executor/plan-builder';
import type { PlannerOutput } from '@/lib/ai/schemas';

const JOB = '11111111-1111-4111-8111-000000000001';
const OTHER_JOB = '11111111-1111-4111-8111-000000000002';
const cid = (n: number) => `22222222-2222-4222-8222-${String(n).padStart(12, '0')}`;

const context: PlannerContext = {
  selectedJobId: JOB,
  jobs: [
    { id: JOB, title: 'Full-Stack Developer', skills: ['React', 'Node.js'] },
    { id: OTHER_JOB, title: 'Product Designer', skills: ['Figma'] },
  ],
  candidates: [
    ...[1, 2, 3, 4, 5].map((n) => ({ id: cid(n), job_id: JOB, name: `Cand ${n}`, stage: 'applied' as const, has_email: n !== 5, skills: [] })),
    { id: cid(6), job_id: OTHER_JOB, name: 'Designer', stage: 'applied' as const, has_email: true, skills: [] },
  ],
};

const DEMO = 'Prepare a 30-minute full-stack developer assessment for the five candidates in this job. Cover React, APIs, SQL and debugging. Show me the questions before inviting anyone.';

function raw(over: Partial<PlannerOutput> = {}): PlannerOutput {
  return {
    intent: 'create_assessment_workflow', job_id: JOB, candidate_ids: [cid(1), cid(2), cid(3), cid(4), cid(5)],
    assessment: { title: 'Full-stack assessment', duration_minutes: 30, question_count: 8, skills: ['React', 'APIs', 'SQL', 'Debugging'], question_types: ['mcq'], difficulty: 'hard' },
    preview_before_invite: false, clarifications: [], guardrail_flags: [], assumptions: [], summary: 'A plan.', ...over,
  };
}

describe('stated values in the instruction', () => {
  it('reads counts and durations in digits and words', () => {
    expect(statedCandidateCount(DEMO)).toBe(5);
    expect(statedDuration(DEMO)).toBe(30);
    expect(statedQuestionCount(DEMO)).toBeNull();
    expect(statedQuestionCount('write 12 questions')).toBe(12);
    expect(statedQuestionCount('a 10-question quiz')).toBe(10);
    expect(statedDuration('a 45 min test')).toBe(45);
    expect(statedDuration('a 1 hour test')).toBe(60);
  });
});

describe('resolvePlan: the demo sentence', () => {
  const { plan, assumptions } = resolvePlan(raw(), context, DEMO);

  it('selects the five candidates and the job', () => {
    expect(plan.job?.id).toBe(JOB);
    expect(plan.candidates).toHaveLength(5);
    expect(plan.candidates.filter((c) => !c.has_email)).toHaveLength(1);
  });
  it('applies defaults for what was not stated and records them', () => {
    expect(plan.assessment?.question_count).toBe(10);
    expect(assumptions).toContain('10 questions (not stated).');
    expect(assumptions.join(' ')).not.toMatch(/minutes \(not stated\)/);
    expect(plan.assessment?.duration_minutes).toBe(30);
  });
  it('resets types and difficulty the instruction never mentioned', () => {
    expect(plan.assessment?.question_types).toEqual(['mcq', 'short']);
    expect(plan.assessment?.difficulty).toBe('mixed');
  });
  it('previews before inviting', () => {
    expect(plan.preview_before_invite).toBe(true);
  });
});

describe('resolvePlan: IDs and clarifications', () => {
  it('drops unknown IDs and candidates from another job, and says so', () => {
    const { plan, clarifications } = resolvePlan(raw({ candidate_ids: [cid(1), cid(6), cid(99)] }), context, 'assessment for these candidates');
    expect(plan.candidates.map((c) => c.id)).toEqual([cid(1)]);
    expect(clarifications.find((c) => c.field === 'candidates')?.blocking).toBe(false);
  });
  it('applies "these five" when the model returned a different set', () => {
    const { plan } = resolvePlan(raw({ candidate_ids: [cid(1)] }), context, 'the five candidates in this job');
    expect(plan.candidates).toHaveLength(5);
  });
  it('falls back to all new candidates when the model picked none, and records it', () => {
    const { plan, assumptions } = resolvePlan(raw({ candidate_ids: [] }), context, 'invite everyone');
    expect(plan.candidates).toHaveLength(5);
    expect(assumptions.join(' ')).toMatch(/all 5 new candidates/);
  });
  it('uses the selected job when the model returned an unknown job', () => {
    const { plan } = resolvePlan(raw({ job_id: '11111111-1111-4111-8111-0000000000ff' }), context, DEMO);
    expect(plan.job?.id).toBe(JOB);
  });
  it('asks which job when there is none to use', () => {
    const { clarifications, plan } = resolvePlan(raw({ job_id: null }), { ...context, selectedJobId: null }, 'make a test');
    expect(clarifications.some((c) => c.field === 'job' && c.blocking)).toBe(true);
    expect(plan.assessment).toBeNull();
  });
  it('asks for candidates when the job has none to invite', () => {
    const empty = { ...context, candidates: [] };
    const { clarifications } = resolvePlan(raw({ candidate_ids: [] }), empty, 'make a test');
    expect(clarifications.some((c) => c.field === 'candidates' && c.blocking)).toBe(true);
  });
});

describe('resolvePlan: guardrail and intents', () => {
  it('merges code flags with model flags without duplicates', () => {
    const { plan } = resolvePlan(
      raw({ guardrail_flags: [{ phrase: 'Under 30', reason: 'model' }, { phrase: 'women', reason: 'model' }] }),
      context, 'only candidates under 30', [{ phrase: 'under 30', reason: 'code' }],
    );
    expect(plan.guardrail_flags.map((f) => f.phrase.toLowerCase()).sort()).toEqual(['under 30', 'women']);
  });
  it('drops a model flag that overlaps a code flag, keeping the standard wording', () => {
    const { plan } = resolvePlan(raw({ guardrail_flags: [{ phrase: 'candidates under 30', reason: 'model wording' }] }), context, 'only candidates under 30', [{ phrase: 'under 30', reason: 'code wording' }]);
    expect(plan.guardrail_flags).toEqual([{ phrase: 'under 30', reason: 'code wording' }]);
  });
  it('ignores the [removed] placeholder if the model flags it', () => {
    const { plan } = resolvePlan(raw({ guardrail_flags: [{ phrase: '[removed]', reason: 'x' }] }), context, 'invite candidates [removed]', []);
    expect(plan.guardrail_flags).toEqual([]);
  });
  it('keeps unsupported plans empty', () => {
    const { plan } = resolvePlan(raw({ intent: 'unsupported', assessment: null }), context, 'book a flight');
    expect(plan).toMatchObject({ intent: 'unsupported', job: null, candidates: [], assessment: null });
    expect(buildSteps(plan)).toEqual([]);
  });
  it('does not require a job for a follow-up sweep', () => {
    const { plan, clarifications } = resolvePlan(raw({ intent: 'follow_up_sweep', job_id: null, assessment: null, candidate_ids: [] }), { ...context, selectedJobId: null }, 'draft follow-ups');
    expect(plan.intent).toBe('follow_up_sweep');
    expect(clarifications).toEqual([]);
  });
});

describe('buildSteps', () => {
  it('builds the six-step template with real numbers and approval flags', () => {
    const { plan } = resolvePlan(raw(), context, DEMO);
    const steps = buildSteps(plan);
    expect(steps.map((s) => s.action)).toEqual(['generate_questions', 'create_assessment', 'create_invitations', 'send_invitations', 'track_submissions', 'score_and_report']);
    expect(steps.map((s) => s.title)).toEqual([
      'Write 10 questions', 'Create the assessment', 'Create 5 candidate links',
      'Send invitations to 4 candidates with email', 'Track submissions', 'Score and prepare reports',
    ]);
    expect(steps.map((s) => s.position)).toEqual([0, 1, 2, 3, 4, 5]);
    expect(steps.filter((s) => s.requires_approval).map((s) => s.action)).toEqual(['create_assessment', 'create_invitations', 'send_invitations']);
    expect(steps.every((s) => s.status === (s.requires_approval ? 'awaiting_approval' : 'planned'))).toBe(true);
    expect(steps[3]?.params).toEqual({ candidateIds: [cid(1), cid(2), cid(3), cid(4)] });
  });
  it('singularises one candidate and names the no-email case', () => {
    const solo = { ...context, candidates: context.candidates.map((c) => ({ ...c, has_email: false })) };
    const { plan } = resolvePlan(raw({ candidate_ids: [cid(1)] }), solo, 'assess one candidate');
    const titles = buildSteps(plan).map((s) => s.title);
    expect(titles).toContain('Create 1 candidate link');
    expect(titles).toContain('Send invitations by email');
  });
  it('builds the two-step follow-up sweep', () => {
    const { plan } = resolvePlan(raw({ intent: 'follow_up_sweep', assessment: null, candidate_ids: [] }), context, 'sweep');
    const steps = buildSteps(plan);
    expect(steps.map((s) => s.action)).toEqual(['analyze_pipeline', 'draft_followups']);
    expect(steps.every((s) => s.requires_approval)).toBe(true);
  });
});
