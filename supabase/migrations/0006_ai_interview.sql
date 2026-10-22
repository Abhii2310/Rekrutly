-- The AI interview: a short spoken or typed conversation after the assessment, built from the candidate's own resume and test.
-- Run once in the Supabase SQL Editor. It only adds things; nothing existing is removed or changed.

alter table assessments add column if not exists ai_interview boolean not null default false;

create table if not exists ai_interviews (
  id             uuid primary key default gen_random_uuid(),
  invitation_id  uuid not null unique references invitations(id) on delete cascade,
  status         text not null default 'in_progress' check (status in ('in_progress', 'completed')),
  plan           jsonb not null,          -- the questions chosen for this person
  turns          jsonb not null default '[]'::jsonb,   -- the conversation, in order
  summary        jsonb,                   -- evidence notes written after it ends
  started_at     timestamptz not null default now(),
  completed_at   timestamptz,
  created_at     timestamptz not null default now()
);
alter table ai_interviews enable row level security;
