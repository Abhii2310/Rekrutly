import { describe, expect, it } from 'vitest';
import { BOARD_COLUMNS, checkDrop, columnOf, movableColumns } from '@/lib/board';

const col = (key: string) => BOARD_COLUMNS.find((c) => c.key === key)!;

describe('hiring board', () => {
  it('puts every active stage in exactly one column', () => {
    for (const s of ['applied', 'assessment_invited', 'assessment_in_progress', 'assessment_submitted', 'under_review', 'interview', 'offer', 'hired'] as const) {
      expect(BOARD_COLUMNS.filter((c) => c.stages.includes(s))).toHaveLength(1);
    }
    expect(columnOf('rejected')).toBeUndefined();
  });
  it('allows the moves the stage rules allow', () => {
    expect(checkDrop('assessment_submitted', col('interview'))).toEqual({ ok: true, to: 'interview' });
    expect(checkDrop('applied', col('interview'))).toEqual({ ok: true, to: 'interview' });
    expect(checkDrop('interview', col('offer'))).toEqual({ ok: true, to: 'offer' });
    expect(checkDrop('offer', col('hired'))).toEqual({ ok: true, to: 'hired' });
  });
  it('refuses skips, system-filled columns and no-ops, with a reason', () => {
    expect(checkDrop('interview', col('hired')).ok).toBe(false);
    const sys = checkDrop('applied', col('invited'));
    expect(sys.ok).toBe(false);
    expect(!sys.ok && sys.reason).toContain('on its own');
    expect(checkDrop('interview', col('interview'))).toEqual({ ok: false, reason: 'Already there.' });
  });
  it('lists where a card can go from its place', () => {
    expect(movableColumns('interview').map((c) => c.key)).toEqual(['offer']);
    expect(movableColumns('hired')).toEqual([]);
  });
});
