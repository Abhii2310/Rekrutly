import { describe, expect, it } from 'vitest';
import { copyShare, FALLBACK_TASKS, flawOutcome, mentionsAny, taskMetrics, timeIsUp, validateTask, type ChatMsg, type TaskDef } from '@/lib/ai-task/rules';

const task = FALLBACK_TASKS[0] as TaskDef;
const T = '2026-10-22T10:00:00Z';
const c = (text: string): ChatMsg => ({ role: 'candidate', text, at: T });
const a = (text: string): ChatMsg => ({ role: 'assistant', text, at: T });

describe('task validation', () => {
  it('accepts every fallback task: the wrong marker is not in the brief, the right one is', () => {
    for (const t of FALLBACK_TASKS) expect(validateTask(t)).toEqual({ ok: true, problems: [] });
  });
  it('rejects a mistake that is really in the brief, or a right marker that is not', () => {
    const bad1: TaskDef = { ...task, flaw: { ...task.flaw, wrongMarkers: ['14 days'] } };
    expect(validateTask(bad1).problems.join(' ')).toContain('appears in the brief');
    const bad2: TaskDef = { ...task, flaw: { ...task.flaw, rightMarkers: ['21 days'] } };
    expect(validateTask(bad2).problems.join(' ')).toContain('No right marker is in the brief');
    expect(validateTask({ ...task, facts: task.facts.slice(0, 2) }).ok).toBe(false);
  });
  it('matches markers case and spacing insensitively', () => {
    expect(mentionsAny('Refunds within  30 DAYS  of purchase', ['30 days'])).toBe(true);
    expect(mentionsAny('nothing here', ['30 days'])).toBe(false);
  });
});

describe('what the candidate did with the mistake', () => {
  const shown = a('Here is a draft. Our policy allows refunds within 30 days of purchase, so she is fine.');
  it('did not get tested if the assistant never made the mistake', () => {
    expect(flawOutcome(task, [a('Sure, what tone?')], 'Hello Meera').outcome).toBe('not_shown');
  });
  it('caught and fixed: challenged it and the final answer states the real policy', () => {
    const r = flawOutcome(task, [shown, c('Wait, the brief says 14 days, not 30. Can you fix that?')], 'Our refund window is 14 days and you are within it.');
    expect(r.outcome).toBe('caught_and_fixed');
    expect(r.challengedAt).toBe(1);
  });
  it('avoided the claim by leaving it out', () => {
    expect(flawOutcome(task, [shown, c('Make it shorter')], 'Hi Meera, you can get a refund.').outcome).toBe('avoided_claim');
  });
  it('questioned but kept the mistake', () => {
    expect(flawOutcome(task, [shown, c('Are you sure about that?')], 'You have 30 days to ask for a refund.').outcome).toBe('questioned_but_kept');
  });
  it('used it without checking', () => {
    expect(flawOutcome(task, [shown, c('Great, thanks')], 'You have 30 days to ask for a refund.').outcome).toBe('used_without_checking');
  });
});

describe('how they worked', () => {
  it('counts prompts, context and checks, and how much was copied word for word', () => {
    const reply = 'Hi Meera, thank you for reaching out. Our policy allows refunds within the window and you are eligible today.';
    const chat = [c('write a reply'), a(reply), c('Please keep it under 120 words because the customer is upset, and double check the policy against the brief.')];
    const m = taskMetrics(chat, reply);
    expect(m.prompts).toBe(2);
    expect(m.withContext).toBe(1);
    expect(m.verifyAsks).toBe(1);
    expect(m.copyShare).toBe(1);
    expect(copyShare('Totally different words written by the candidate themselves here', [reply])).toBe(0);
    expect(copyShare('short', [reply])).toBe(0);
  });
  it('counts time from the server clock', () => {
    expect(timeIsUp(T, new Date('2026-10-22T10:19:00Z'))).toBe(false);
    expect(timeIsUp(T, new Date('2026-10-22T10:21:00Z'))).toBe(true);
  });
});
