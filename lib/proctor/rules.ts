/** Pure rules that turn what the camera sees, sampled a few times a second, into review signals. */
export type CameraSignal = 'face_missing' | 'multiple_faces' | 'looking_away' | 'eyes_away';
/** `yaw`: how far the head is turned. `gaze`: how far the eyes point sideways (0 is at the screen, 1 is fully sideways). */
export type Observation = { faces: number; yaw: number | null; gaze?: number | null };

/** How long something must keep happening before it is worth a flag, so a blink or a sneeze is never flagged. */
export const HOLD_MS: Record<CameraSignal, number> = { face_missing: 3000, multiple_faces: 2000, looking_away: 3500, eyes_away: 4000 };
/** The same flag is not raised again for this long, so the list stays readable. */
export const COOLDOWN_MS = 20_000;
/** Nose offset from the middle of the eyes, as a fraction of the distance between the eyes. */
export const YAW_LIMIT = 0.55;
/** Eyes this far sideways, with the head still facing the screen, count as looking elsewhere. */
export const GAZE_LIMIT = 0.6;

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
  if (signal === 'looking_away') return o.faces === 1 && o.yaw !== null && Math.abs(o.yaw) > YAW_LIMIT;
  // Eyes away is only raised when the head is facing the screen, so one glance sideways is not counted twice.
  return o.faces === 1 && (o.gaze ?? 0) > GAZE_LIMIT && !(o.yaw !== null && Math.abs(o.yaw) > YAW_LIMIT);
}

/** Feed one observation; returns the signals to raise now. Mutates `state`. */
export function step(state: RuleState, o: Observation, nowMs: number): CameraSignal[] {
  const fired: CameraSignal[] = [];
  for (const signal of ['face_missing', 'multiple_faces', 'looking_away', 'eyes_away'] as const) {
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

/** Voice: the microphone level is sampled several times a second and only on the device, never uploaded for analysis. */
export const VOICE_HOLD_MS = 2000;
/** Level above the quiet room's own noise, as a ratio, and never below this floor, so a fan or keyboard is not a voice. */
export const VOICE_RATIO = 3.5;
export const VOICE_MIN_LEVEL = 0.03;
export const VOICE_COOLDOWN_MS = 20_000;

export type VoiceState = { noise: number; since: number | null; lastFired: number | null; samples: number };
export const newVoiceState = (): VoiceState => ({ noise: 0.005, since: null, lastFired: null, samples: 0 });

/** Feed one level (0 to 1, RMS). Returns true when a voice has been heard long enough to flag. Mutates `state`. */
export function stepVoice(state: VoiceState, level: number, nowMs: number): boolean {
  state.samples++;
  const loud = state.samples > 10 && level > Math.max(VOICE_MIN_LEVEL, state.noise * VOICE_RATIO);
  // The quiet level adapts slowly, and only from quiet samples, so talking never raises its own bar.
  if (!loud) state.noise = state.noise * 0.95 + level * 0.05;
  if (!loud) { state.since = null; return false; }
  state.since ??= nowMs;
  if (nowMs - state.since >= VOICE_HOLD_MS && (state.lastFired === null || nowMs - state.lastFired >= VOICE_COOLDOWN_MS)) {
    state.lastFired = nowMs;
    return true;
  }
  return false;
}
