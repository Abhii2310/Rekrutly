import { describe, expect, it } from 'vitest';
import { COOLDOWN_MS, HOLD_MS, newRuleState, newVoiceState, step, stepVoice, VOICE_COOLDOWN_MS, yawRatio } from '@/lib/proctor/rules';

const run = (state = newRuleState(), obs: { faces: number; yaw: number | null; gaze?: number | null }, from: number, to: number) => {
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
  it('flags eyes pointing sideways, but only when the head faces the screen', () => {
    expect(run(newRuleState(), { faces: 1, yaw: 0.1, gaze: 0.9 }, 0, 5000)).toEqual(['eyes_away']);
    expect(run(newRuleState(), { faces: 1, yaw: 0.1, gaze: 0.2 }, 0, 10_000)).toEqual([]);
    expect(run(newRuleState(), { faces: 1, yaw: 0.9, gaze: 0.9 }, 0, 5000)).toEqual(['looking_away']);
  });
});

describe('voice rule', () => {
  const feed = (s: ReturnType<typeof newVoiceState>, level: number, from: number, to: number) => {
    let fired = 0;
    for (let t = from; t <= to; t += 200) if (stepVoice(s, level, t)) fired++;
    return fired;
  };
  it('ignores a quiet room and a short noise', () => {
    const s = newVoiceState();
    expect(feed(s, 0.004, 0, 5000)).toBe(0);
    expect(feed(s, 0.2, 5200, 6000)).toBe(0);
  });
  it('flags a voice that goes on, then waits before flagging again', () => {
    const s = newVoiceState();
    feed(s, 0.004, 0, 3000);
    expect(feed(s, 0.2, 3200, 8000)).toBe(1);
    expect(feed(s, 0.2, 8200, 8000 + VOICE_COOLDOWN_MS + 3000)).toBe(1);
  });
});
