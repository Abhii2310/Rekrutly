-- Two more review signals for proctored tests: eyes looking away from the screen, and a voice heard in the room.
-- Run once in the Supabase SQL Editor. It only widens the allowed list; nothing existing changes.
alter table integrity_signals drop constraint if exists integrity_signals_type_check;
alter table integrity_signals add constraint integrity_signals_type_check check (type in (
  'tab_hidden', 'paste', 'window_blur',
  'face_missing', 'multiple_faces', 'looking_away', 'camera_off',
  'fullscreen_exit', 'copy', 'offline',
  'eyes_away', 'voice_detected'
));
