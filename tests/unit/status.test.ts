import { describe, expect, it } from 'vitest';
import {
  CANDIDATE_STAGES, RUN_STATUSES, allowedTransitions, assertTransition, canTransition, statusLabel, statusTone, statusValues,
} from '@/lib/status';

describe('canTransition', () => {
  it('allows the documented run path', () => {
    const path = ['draft', 'awaiting_approval', 'approved', 'executing', 'waiting', 'completed'] as const;
    for (let i = 0; i < path.length - 1; i++) expect(canTransition('run', path[i]!, path[i + 1]!)).toBe(true);
  });

  it('allows any live run status to fail, and only draft/awaiting to cancel', () => {
    for (const s of ['draft', 'awaiting_approval', 'approved', 'executing', 'waiting'] as const) {
      expect(canTransition('run', s, 'failed')).toBe(true);
    }
    expect(canTransition('run', 'draft', 'cancelled')).toBe(true);
    expect(canTransition('run', 'awaiting_approval', 'cancelled')).toBe(true);
    expect(canTransition('run', 'executing', 'cancelled')).toBe(false);
  });

  it('pauses and resumes executing and waiting runs', () => {
    expect(canTransition('run', 'executing', 'paused')).toBe(true);
    expect(canTransition('run', 'waiting', 'paused')).toBe(true);
    expect(canTransition('run', 'paused', 'executing')).toBe(true);
    expect(canTransition('run', 'paused', 'waiting')).toBe(true);
  });

  it('rejects backwards moves, same-status moves and moves out of terminal states', () => {
    expect(canTransition('run', 'completed', 'executing')).toBe(false);
    expect(canTransition('run', 'draft', 'draft')).toBe(false);
    expect(canTransition('run', 'cancelled', 'draft')).toBe(false);
    expect(canTransition('step', 'completed', 'queued')).toBe(false);
    expect(canTransition('invitation', 'submitted', 'started')).toBe(false);
  });

  it('follows the invitation path and lets the recruiter move candidates but never straight to hired', () => {
    expect(canTransition('invitation', 'created', 'sent')).toBe(true);
    expect(canTransition('invitation', 'opened', 'started')).toBe(true);
    expect(canTransition('invitation', 'started', 'submitted')).toBe(true);
    expect(canTransition('invitation', 'created', 'submitted')).toBe(false);
    expect(canTransition('candidate', 'applied', 'assessment_invited')).toBe(true);
    expect(canTransition('candidate', 'applied', 'hired')).toBe(false);
    expect(canTransition('candidate', 'interview', 'offer')).toBe(true);
    expect(canTransition('candidate', 'hired', 'applied')).toBe(false);
  });

  it('follows the step and assessment paths', () => {
    expect(canTransition('step', 'planned', 'awaiting_approval')).toBe(true);
    expect(canTransition('step', 'awaiting_approval', 'queued')).toBe(true);
    expect(canTransition('step', 'queued', 'executing')).toBe(true);
    expect(canTransition('step', 'executing', 'waiting')).toBe(true);
    expect(canTransition('step', 'failed', 'queued')).toBe(true);
    expect(canTransition('assessment', 'draft', 'approved')).toBe(true);
    expect(canTransition('assessment', 'approved', 'live')).toBe(true);
    expect(canTransition('assessment', 'draft', 'live')).toBe(false);
  });
});

describe('assertTransition', () => {
  it('returns ok for valid and a typed error for invalid moves', () => {
    expect(assertTransition('run', 'draft', 'awaiting_approval').ok).toBe(true);
    const r = assertTransition('run', 'completed', 'draft');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('invalid_transition');
  });
});

describe('status map', () => {
  it('has labels and tones for every value of every kind', () => {
    for (const v of RUN_STATUSES) {
      expect(statusLabel('run', v).length).toBeGreaterThan(0);
      expect(statusTone('run', v)).toBeTruthy();
    }
    for (const v of CANDIDATE_STAGES) expect(statusLabel('candidate', v)).not.toBe(v);
  });

  it('uses the recruiter words from the spec', () => {
    expect(statusLabel('run', 'awaiting_approval')).toBe('Waiting for you');
    expect(statusLabel('run', 'waiting')).toBe('In progress');
    expect(statusLabel('candidate', 'assessment_invited')).toBe('Invited');
    expect(statusLabel('candidate', 'assessment_submitted')).toBe('Submitted');
    expect(statusLabel('candidate', 'under_review')).toBe('In review');
    expect(statusLabel('delivery', 'unconfigured')).toBe('Email not configured');
  });

  it('every transition target is a valid value of that kind', () => {
    for (const kind of ['job', 'candidate', 'run', 'step', 'assessment', 'invitation', 'delivery', 'scoring', 'report', 'task'] as const) {
      const values = statusValues(kind) as readonly string[];
      for (const from of values) {
        for (const to of allowedTransitions(kind, from as never) as readonly string[]) expect(values).toContain(to);
      }
    }
  });
});
