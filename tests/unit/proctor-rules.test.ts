import { describe, expect, it } from 'vitest';
import { COOLDOWN_MS, HOLD_MS, newRuleState, step, yawRatio } from '@/lib/proctor/rules';

const run = (state = newRuleState(), obs: { faces: number; yaw: number | null }, from: number, to: number) => {
  const out: string[] = [];
  for (let t = from; t <= to; t += 500) out.push(...step(state, obs, t));
  return out;
};

describe('camera rules', () => {
  it('does not flag a short absence', () => {
    expect(run(newRuleState(), { faces: 0, yaw: null }, 0, HOLD_MS.face_missing - 500)).toEqual([]);
  });
  it('flags a face missing once it lasts, then waits before flagging again', () => {
    const s = newRuleState();
    expect(run(s, { faces: 0, yaw: null }, 0, 10_000)).toEqual(['face_missing']);
    expect(run(s, { faces: 0, yaw: null }, 10_500, COOLDOWN_MS + HOLD_MS.face_missing)).toEqual(['face_missing']);
  });
  it('resets when the face comes back', () => {
    const s = newRuleState();
    run(s, { faces: 0, yaw: null }, 0, 2500);
    run(s, { faces: 1, yaw: 0 }, 3000, 3000);
    expect(run(s, { faces: 0, yaw: null }, 3500, 5500)).toEqual([]);
  });
  it('flags two faces and a turned head, but not a head looking at the screen', () => {
    expect(run(newRuleState(), { faces: 2, yaw: 0 }, 0, 3000)).toEqual(['multiple_faces']);
    expect(run(newRuleState(), { faces: 1, yaw: 0.9 }, 0, 4000)).toEqual(['looking_away']);
    expect(run(newRuleState(), { faces: 1, yaw: 0.1 }, 0, 10_000)).toEqual([]);
  });
  it('computes how far the head is turned', () => {
    expect(yawRatio({ x: 0.4, y: 0.4 }, { x: 0.6, y: 0.4 }, { x: 0.5, y: 0.5 })).toBeCloseTo(0);
    expect(yawRatio({ x: 0.4, y: 0.4 }, { x: 0.6, y: 0.4 }, { x: 0.6, y: 0.5 })).toBeCloseTo(0.5);
    expect(yawRatio(undefined, undefined, undefined)).toBeNull();
  });
});
