import { describe, expect, it } from 'vitest';
import { applyAnswer, askedMain, candidateText, currentPrompt, fallbackPlan, firstTurn, isVague, MAIN_QUESTIONS, timeIsUp, type PlanQuestion } from '@/lib/ai-interview/rules';

const plan: PlanQuestion[] = [1, 2, 3].map((n) => ({ question: `Question ${n}?`, topic: `T${n}`, basis: 'role' as const }));
const T = '2026-10-22T10:00:00Z';
const long = 'I led the redesign of our checkout flow, ran five usability sessions and shipped it in six weeks with two engineers.';

describe('interview flow', () => {
  it('starts with the first planned question', () => {
    expect(firstTurn(plan, T)).toMatchObject({ role: 'ai', kind: 'question', qi: 0, text: 'Question 1?' });
  });
  it('digs in with a follow-up after a real answer, then moves on after the follow-up', () => {
    const turns = [firstTurn(plan, T)!];
    const s1 = applyAnswer(plan, turns, long, false, 'What was the hardest trade-off you made?', T);
    expect(s1.next).toMatchObject({ kind: 'followup', qi: 0 });
    const s2 = applyAnswer(plan, s1.turns, long, false, 'Another follow-up?', T);
    expect(s2.next).toMatchObject({ kind: 'question', qi: 1, text: 'Question 2?' });
    expect(askedMain(s2.turns)).toBe(2);
  });
  it('does not push a follow-up on a vague or skipped answer', () => {
    const turns = [firstTurn(plan, T)!];
    expect(applyAnswer(plan, turns, "I don't know", false, 'Why?', T).next).toMatchObject({ kind: 'question', qi: 1 });
    expect(applyAnswer(plan, turns, '', true, 'Why?', T).next).toMatchObject({ kind: 'question', qi: 1 });
    expect(isVague('short')).toBe(true);
    expect(isVague(long)).toBe(false);
  });
  it('finishes after the last question and never lets the transcript grow without limit', () => {
    let step = { turns: [firstTurn(plan, T)!], next: null as unknown, done: false } as ReturnType<typeof applyAnswer>;
    for (let i = 0; i < 6 && !step.done; i++) step = applyAnswer(plan, step.turns, 'ok', false, null, T);
    expect(step.done).toBe(true);
    expect(step.turns.length).toBeLessThanOrEqual(16);
    expect(currentPrompt(step.turns)).toBeNull();
  });
  it('ignores an answer when nothing was asked', () => {
    expect(applyAnswer(plan, [], 'hello', false, null, T)).toEqual({ turns: [], next: null, done: false });
  });
  it('counts the time from the server clock', () => {
    expect(timeIsUp(T, new Date('2026-10-22T10:24:00Z'))).toBe(false);
    expect(timeIsUp(T, new Date('2026-10-22T10:26:00Z'))).toBe(true);
  });
  it('keeps only what the candidate said, without skipped answers', () => {
    const t = [{ role: 'candidate' as const, kind: 'answer' as const, qi: 0, text: 'a', at: T }, { role: 'candidate' as const, kind: 'answer' as const, qi: 1, text: '', at: T, skipped: true }];
    expect(candidateText(t)).toBe('a');
  });
});

describe('fallback plan', () => {
  it('uses the weakest skills first and stays within the limit', () => {
    const p = fallbackPlan({ jobTitle: 'Designer', skills: ['Figma', 'Research', 'Prototyping'], weakSkills: ['Research'], hasResume: true });
    expect(p.length).toBeLessThanOrEqual(MAIN_QUESTIONS);
    expect(p[0]?.basis).toBe('resume');
    expect(p[1]?.question).toContain('Research');
    expect(p[2]?.question).toContain('Figma');
  });
});
