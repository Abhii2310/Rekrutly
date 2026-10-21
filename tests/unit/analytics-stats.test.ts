import { describe, expect, it } from 'vitest';
import {
  completionTakeaway, computeAnalytics, formatMinutes, funnelTakeaway, mean, median, skillsTakeaway, speedTakeaway, type AnalyticsInput,
} from '@/lib/analytics/stats';

describe('median and mean', () => {
  it('handles odd, even and empty counts', () => {
    expect(median([5, 1, 3])).toBe(3);
    expect(median([4, 1, 3, 2])).toBe(2.5);
    expect(median([7])).toBe(7);
    expect(median([])).toBeNull();
    expect(mean([1, 2, 6])).toBe(3);
    expect(mean([])).toBeNull();
  });
  it('does not change the input order', () => {
    const xs = [3, 1, 2]; median(xs); expect(xs).toEqual([3, 1, 2]);
  });
});

describe('formatMinutes', () => {
  it('writes minutes the way a person says them', () => {
    expect(formatMinutes(null)).toBe('–');
    expect(formatMinutes(0.4)).toBe('under 1 min');
    expect(formatMinutes(12.4)).toBe('12 min');
    expect(formatMinutes(60)).toBe('1 h');
    expect(formatMinutes(65)).toBe('1 h 5 min');
  });
});

const iso = (min: number) => new Date(Date.UTC(2026, 9, 21, 12, 0) + min * 60_000).toISOString();
const input: AnalyticsInput = {
  jobs: [{ id: 'j1', title: 'Full-Stack', is_demo: false }, { id: 'j2', title: 'Go', is_demo: false }],
  candidates: [
    { job_id: 'j1', stage: 'applied', is_demo: false }, { job_id: 'j1', stage: 'assessment_submitted', is_demo: false }, { job_id: 'j1', stage: 'interview', is_demo: false },
    { job_id: 'j2', stage: 'applied', is_demo: false },
  ],
  assessments: [{ id: 'a1', job_id: 'j1' }, { id: 'a2', job_id: 'j2' }],
  invitations: [
    { id: 'i1', assessment_id: 'a1', created_at: iso(0), started_at: iso(10), submitted_at: iso(40) },
    { id: 'i2', assessment_id: 'a1', created_at: iso(0), started_at: iso(30), submitted_at: iso(50) },
    { id: 'i3', assessment_id: 'a1', created_at: iso(0), started_at: null, submitted_at: null },
    { id: 'i4', assessment_id: 'a2', created_at: iso(0), started_at: iso(5), submitted_at: iso(15) },
  ],
  submissions: [
    { invitation_id: 'i1', objective_score: 8, objective_max: 10, final_score: 14, final_max: 20, scoring_status: 'scored', is_simulated: false, skill_breakdown: [{ skill: 'React', percent: 100 }, { skill: 'SQL', percent: 40 }] },
    { invitation_id: 'i2', objective_score: 6, objective_max: 10, final_score: null, final_max: null, scoring_status: 'pending', is_simulated: true, skill_breakdown: [] },
    { invitation_id: 'i4', objective_score: 10, objective_max: 10, final_score: 10, final_max: 10, scoring_status: 'scored', is_simulated: false, skill_breakdown: [{ skill: 'Go', percent: 100 }] },
  ],
  tasks: [{ type: 'follow_up', job_id: 'j1' }, { type: 'follow_up', job_id: 'j1' }, { type: 'missing_email', job_id: 'j1' }, { type: 'follow_up', job_id: 'j2' }],
};

describe('computeAnalytics', () => {
  it('counts for one job only', () => {
    const a = computeAnalytics(input, 'j1');
    expect(a).toMatchObject({ invited: 3, started: 2, submitted: 2, totalCandidates: 3, avgObjectivePct: 70, avgFinalPct: 70 });
    expect(a.completionRate).toBeCloseTo(2 / 3);
    expect(a.medianMinutesToStart).toBe(20); // 10 and 30
    expect(a.medianMinutesToFinish).toBe(25); // 30 and 20
    expect(a.skills).toEqual([{ skill: 'React', avgPct: 100, submissions: 1 }, { skill: 'SQL', avgPct: 40, submissions: 1 }]);
    expect(a.tasksByType).toEqual([{ type: 'follow_up', count: 2 }, { type: 'missing_email', count: 1 }]);
    expect(a.simulatedSubmissions).toBe(1);
    expect(a.includesDemo).toBe(true);
  });
  it('covers every job when none is chosen, and ignores unscored submissions for final and skills', () => {
    const a = computeAnalytics(input, null);
    expect(a.invited).toBe(4);
    expect(a.submitted).toBe(3);
    expect(a.avgFinalPct).toBe(85); // (70 + 100) / 2: the pending submission is left out
    expect(a.skills.map((s) => s.skill)).toEqual(['Go', 'React', 'SQL']);
  });
  it('is empty and honest when nothing exists', () => {
    const a = computeAnalytics({ ...input, invitations: [], submissions: [], candidates: [], tasks: [] }, null);
    expect(a).toMatchObject({ invited: 0, submitted: 0, completionRate: null, avgObjectivePct: null, avgFinalPct: null, medianMinutesToStart: null, medianMinutesToFinish: null });
    expect(a.includesDemo).toBe(false);
  });
  it('flags demo data by job or candidate', () => {
    const demo = { ...input, jobs: input.jobs.map((j) => ({ ...j, is_demo: true })), submissions: input.submissions.map((s) => ({ ...s, is_simulated: false })) };
    expect(computeAnalytics(demo, 'j1').includesDemo).toBe(true);
  });
});

describe('takeaway sentences', () => {
  it('writes the completion sentence from the numbers', () => {
    expect(completionTakeaway({ invited: 5, submitted: 4, avgObjectivePct: 68 })).toBe('4 of 5 invited candidates finished. Average objective score 68%.');
    expect(completionTakeaway({ invited: 1, submitted: 0, avgObjectivePct: null })).toBe('0 of 1 invited candidate finished.');
    expect(completionTakeaway({ invited: 0, submitted: 0, avgObjectivePct: null })).toBeNull();
  });
  it('summarises the pipeline and the skills', () => {
    const a = computeAnalytics(input, 'j1');
    expect(funnelTakeaway(a)).toBe('3 candidates in the pipeline: 1 new, 1 submitted, 1 interview.');
    expect(skillsTakeaway(a.skills)).toBe('Candidates scored highest on React (100%) and lowest on SQL (40%).');
    expect(skillsTakeaway([{ skill: 'SQL', avgPct: 50, submissions: 2 }])).toBe('SQL: average 50% across 2 submissions.');
    expect(skillsTakeaway([{ skill: 'A', avgPct: 70, submissions: 1 }, { skill: 'B', avgPct: 70, submissions: 1 }])).toBe('Every skill averaged 70%.');
    expect(skillsTakeaway([])).toBeNull();
  });
  it('writes the speed sentences only for medians that exist', () => {
    expect(speedTakeaway({ medianMinutesToStart: 20, medianMinutesToFinish: 25 })).toEqual([
      'Candidates start a median of 20 min after their link is created.', 'They finish a median of 25 min after starting.',
    ]);
    expect(speedTakeaway({ medianMinutesToStart: null, medianMinutesToFinish: null })).toEqual([]);
  });
  it('never ranks or labels anyone', () => {
    const text = [completionTakeaway({ invited: 5, submitted: 4, avgObjectivePct: 68 }), funnelTakeaway(computeAnalytics(input, null)), skillsTakeaway(computeAnalytics(input, null).skills)].join(' ').toLowerCase();
    for (const w of ['best', 'top candidate', 'recommended', 'winner', 'rank']) expect(text).not.toContain(w);
  });
});
