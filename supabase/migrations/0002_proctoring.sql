-- Proctored exams: opt-in camera recording and review signals.
-- Run this once in the Supabase SQL Editor. It only adds things; nothing existing is removed or changed,
-- so the app keeps working before and after.

-- 1. An assessment can be proctored. Off by default.
alter table assessments add column if not exists proctored boolean not null default false;

-- 2. When the candidate agreed to be recorded, and when their latest camera snapshot arrived.
alter table invitations add column if not exists proctor_consent_at timestamptz;
alter table invitations add column if not exists last_snapshot_at timestamptz;

-- 3. More kinds of signal. They are hints for a person to review, never proof.
alter table integrity_signals drop constraint if exists integrity_signals_type_check;
alter table integrity_signals add constraint integrity_signals_type_check check (type in (
  'tab_hidden', 'paste', 'window_blur',
  'face_missing', 'multiple_faces', 'looking_away', 'camera_off',
  'fullscreen_exit', 'copy', 'offline'
));
alter table integrity_signals add column if not exists detail jsonb;
-- Milliseconds from the start of the recording, so a flagged moment can be found in the video.
alter table integrity_signals add column if not exists video_ms integer check (video_ms is null or video_ms >= 0);

-- 4. The recording is stored as 30-second pieces, each playable on its own, in a private storage bucket.
create table if not exists proctor_segments (
  id             uuid primary key default gen_random_uuid(),
  invitation_id  uuid not null references invitations(id) on delete cascade,
  seq            integer not null check (seq >= 0),
  storage_path   text not null,
  started_ms     integer not null check (started_ms >= 0),   -- offset from the start of the exam
  duration_ms    integer not null check (duration_ms >= 0),
  bytes          integer not null check (bytes >= 0),
  created_at     timestamptz not null default now(),
  unique (invitation_id, seq)
);
create index if not exists proctor_segments_invitation_idx on proctor_segments (invitation_id, seq);

-- Same lock-down as every other table: row-level security on, no public policies.
alter table proctor_segments enable row level security;
