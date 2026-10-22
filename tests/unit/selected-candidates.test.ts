import { describe, expect, it } from 'vitest';
import { applySelectedCandidates, type PlannerContext, type ResolvedPlan } from '@/lib/ai/resolve-plan';

const J1 = '11111111-1111-4111-8111-000000000001';
const J2 = '11111111-1111-4111-8111-000000000002';
const cand = (id: string, job: string, name: string, email = true) => ({ id, job_id: job, name, stage: 'applied' as const, has_email: email, skills: [] as string[] });
const ctx: PlannerContext = { jobs: [], selectedJobId: J1, candidates: [cand('a', J1, 'Asha'), cand('b', J1, 'Bo', false), cand('c', J1, 'Cy'), cand('x', J2, 'Other')] };

const plan = (): ResolvedPlan => ({
  intent: 'create_assessment_workflow', job: { id: J1, title: 'Dev' }, candidates: [{ id: 'a', name: 'Asha', has_email: true }, { id: 'c', name: 'Cy', has_email: true }],
  assessment: null, assumptions: ['Used all 2 new candidates in this job.', '10 questions (not stated).'], clarifications: [{ field: 'candidates', question: 'Which?', blocking: true }],
  guardrail_flags: [], preview_before_invite: true, summary: 's',
} as unknown as ResolvedPlan);

describe('applySelectedCandidates', () => {
  it('replaces the model pick with exactly the selected people', () => {
    const p = plan();
    const cl = [...p.clarifications];
    expect(applySelectedCandidates(p, cl, ctx, ['b', 'a'])).toBe(2);
    expect(p.candidates.map((c) => c.id)).toEqual(['b', 'a']);
    expect(p.assumptions[0]).toBe('Only the 2 people you selected.');
    expect(p.assumptions.join(' ')).not.toContain('new candidates in this job');
    expect(cl).toEqual([]);
    expect(p.clarifications).toEqual([]);
  });
  it('ignores people from another job and duplicates', () => {
    const p = plan();
    expect(applySelectedCandidates(p, [], ctx, ['x', 'a', 'a'])).toBe(1);
    expect(p.candidates.map((c) => c.id)).toEqual(['a']);
  });
  it('changes nothing when nobody selected is in the job', () => {
    const p = plan();
    expect(applySelectedCandidates(p, [], ctx, ['x'])).toBe(0);
    expect(p.candidates).toHaveLength(2);
  });
});
