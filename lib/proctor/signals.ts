/** The kinds of review signal. Shared by the candidate page, the API and the recruiter screens. Hints for a person, never proof. */
export const BASIC_SIGNALS = ['tab_hidden', 'paste', 'window_blur'] as const;
export const CAMERA_SIGNALS = ['face_missing', 'multiple_faces', 'looking_away', 'eyes_away', 'voice_detected', 'camera_off'] as const;
export const SCREEN_SIGNALS = ['fullscreen_exit', 'copy', 'offline'] as const;

export const SIGNAL_TYPE_LIST = [...BASIC_SIGNALS, ...CAMERA_SIGNALS, ...SCREEN_SIGNALS] as const;
export type SignalType = (typeof SIGNAL_TYPE_LIST)[number];

const ALL = new Set<string>(SIGNAL_TYPE_LIST);
export const isSignalType = (t: string): t is SignalType => ALL.has(t);

/** Plain words for the recruiter. Never "cheating". */
export const SIGNAL_LABEL: Record<SignalType, string> = {
  tab_hidden: 'Switched tab',
  paste: 'Pasted text',
  window_blur: 'Left the window',
  face_missing: 'No face in view',
  multiple_faces: 'More than one face',
  looking_away: 'Head turned away',
  eyes_away: 'Eyes off the screen',
  voice_detected: 'Voice heard',
  camera_off: 'Camera turned off',
  fullscreen_exit: 'Left full screen',
  copy: 'Copied text',
  offline: 'Went offline',
};

/** Worth a recruiter's attention in the live list. Switching window and pasting are shown as counts instead. */
export const ALERT_SIGNALS: ReadonlySet<string> = new Set<string>([...CAMERA_SIGNALS, 'tab_hidden', 'fullscreen_exit', 'copy', 'offline']);

export const signalLabel = (t: string): string => (isSignalType(t) ? SIGNAL_LABEL[t] : t);
