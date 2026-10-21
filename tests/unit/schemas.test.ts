import { describe, expect, it } from 'vitest';
import { CandidateReport, FollowUpDraft, GeneratedQuestion, PlannerOutput, QuestionSet, ShortAnswerGrade } from '@/lib/ai/schemas';

const uuid = '11111111-1111-4111-8111-000000000001';

const planner = {
  intent: 'create_assessment_workflow', job_id: uuid, candidate_ids: [uuid],
  assessment: { title: 'Full-stack assessment', duration_minutes: 30, question_count: 10, skills: ['React'], question_types: ['mcq', 'short'], difficulty: 'mixed' },
  preview_before_invite: true, clarifications: [], guardrail_flags: [], assumptions: [], summary: 'A plan.',
};
const mcq = { type: 'mcq', prompt: 'Which hook runs after render?', options: ['a', 'b', 'c', 'd'], correct_option: 1, explanation: 'x', skill: 'React', difficulty: 'easy', max_score: 1 };
const short = { type: 'short', prompt: 'Explain how an index speeds up a query.', rubric: { criteria: [{ point: 'a', weight: 1 }, { point: 'b', weight: 2 }], model_answer: 'm' }, skill: 'SQL', difficulty: 'medium', max_score: 5 };

describe('PlannerOutput', () => {
  it('accepts a valid plan and a null assessment', () => {
    expect(PlannerOutput.safeParse(planner).success).toBe(true);
    expect(PlannerOutput.safeParse({ ...planner, intent: 'unsupported', assessment: null, job_id: null, candidate_ids: [] }).success).toBe(true);
  });
  it('rejects a bad intent and a non-uuid id', () => {
    expect(PlannerOutput.safeParse({ ...planner, intent: 'book_flight' }).success).toBe(false);
    expect(PlannerOutput.safeParse({ ...planner, candidate_ids: ['nope'] }).success).toBe(false);
  });
  it('rejects out-of-range assessment values', () => {
    const bad = { ...planner, assessment: { ...planner.assessment, duration_minutes: 2 } };
    expect(PlannerOutput.safeParse(bad).success).toBe(false);
  });
});

describe('GeneratedQuestion and QuestionSet', () => {
  it('accepts mcq and short questions', () => {
    expect(GeneratedQuestion.safeParse(mcq).success).toBe(true);
    expect(GeneratedQuestion.safeParse(short).success).toBe(true);
    expect(QuestionSet.safeParse({ questions: [mcq, mcq, short] }).success).toBe(true);
  });
  it('rejects an mcq with 3 options or a short question without a rubric', () => {
    expect(GeneratedQuestion.safeParse({ ...mcq, options: ['a', 'b', 'c'] }).success).toBe(false);
    expect(GeneratedQuestion.safeParse({ ...short, rubric: undefined }).success).toBe(false);
  });
  it('rejects fewer than 3 questions', () => {
    expect(QuestionSet.safeParse({ questions: [mcq, short] }).success).toBe(false);
  });
});

describe('ShortAnswerGrade', () => {
  const grade = { score: 3, matched_criteria: ['a'], missing_criteria: [], evidence_quote: 'q', reasoning: 'r', confidence: 'high' };
  it('accepts a grade; rejects a negative score or unknown confidence', () => {
    expect(ShortAnswerGrade.safeParse(grade).success).toBe(true);
    expect(ShortAnswerGrade.safeParse({ ...grade, score: -1 }).success).toBe(false);
    expect(ShortAnswerGrade.safeParse({ ...grade, confidence: 'sure' }).success).toBe(false);
  });
});

describe('CandidateReport', () => {
  const iq = { skill: 'SQL', question: 'q', what_good_looks_like: 'w' };
  const report = { summary: 's', strengths: [], gaps: [], interview_questions: [iq, iq, iq], missing_evidence: [] };
  it('needs 3 to 6 interview questions', () => {
    expect(CandidateReport.safeParse(report).success).toBe(true);
    expect(CandidateReport.safeParse({ ...report, interview_questions: [iq] }).success).toBe(false);
  });
});

describe('FollowUpDraft', () => {
  it('only allows en, hi, kn', () => {
    const d = { language: 'hi', subject: 's', body: 'b', whatsapp_text: 'w' };
    expect(FollowUpDraft.safeParse(d).success).toBe(true);
    expect(FollowUpDraft.safeParse({ ...d, language: 'fr' }).success).toBe(false);
  });
});
