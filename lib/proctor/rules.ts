/** Pure rules that turn what the camera sees, sampled a few times a second, into review signals. */
export type CameraSignal = 'face_missing' | 'multiple_faces' | 'looking_away';
export type Observation = { faces: number; yaw: number | null };

/** How long something must keep happening before it is worth a flag, so a blink or a sneeze is never flagged. */
export const HOLD_MS: Record<CameraSignal, number> = { face_missing: 3000, multiple_faces: 2000, looking_away: 3500 };
/** The same flag is not raised again for this long, so the list stays readable. */
export const COOLDOWN_MS = 20_000;
/** Nose offset from the middle of the eyes, as a fraction of the distance between the eyes. */
export const YAW_LIMIT = 0.55;

export type RuleState = { since: Partial<Record<CameraSignal, number>>; lastFired: Partial<Record<CameraSignal, number>> };
export const newRuleState = (): RuleState => ({ since: {}, lastFired: {} });

type Point = { x: number; y: number };

/** Roughly how far the head is turned: 0 is facing the screen. Needs the two eyes and the nose tip. */
export function yawRatio(rightEye: Point | undefined, leftEye: Point | undefined, nose: Point | undefined): number | null {
  if (!rightEye || !leftEye || !nose) return null;
  const dist = Math.abs(rightEye.x - leftEye.x);
  if (dist < 1e-4) return null;
  return (nose.x - (rightEye.x + leftEye.x) / 2) / dist;
}

function active(signal: CameraSignal, o: Observation): boolean {
  if (signal === 'face_missing') return o.faces === 0;
  if (signal === 'multiple_faces') return o.faces >= 2;
  return o.faces === 1 && o.yaw !== null && Math.abs(o.yaw) > YAW_LIMIT;
}

/** Feed one observation; returns the signals to raise now. Mutates `state`. */
export function step(state: RuleState, o: Observation, nowMs: number): CameraSignal[] {
  const fired: CameraSignal[] = [];
  for (const signal of ['face_missing', 'multiple_faces', 'looking_away'] as const) {
    if (!active(signal, o)) {
      delete state.since[signal];
      continue;
    }
    const since = state.since[signal] ?? (state.since[signal] = nowMs);
    const last = state.lastFired[signal];
    if (nowMs - since >= HOLD_MS[signal] && (last === undefined || nowMs - last >= COOLDOWN_MS)) {
      state.lastFired[signal] = nowMs;
      fired.push(signal);
    }
  }
  return fired;
}
