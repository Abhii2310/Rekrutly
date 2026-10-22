-- The AI-collaboration task: a real work task with an AI assistant that is sometimes wrong, to see who checks it.
-- Run once in the Supabase SQL Editor. It only adds things; nothing existing is removed or changed.

alter table assessments add column if not exists ai_task boolean not null default false;

create table if not exists ai_tasks (
  id             uuid primary key default gen_random_uuid(),
  invitation_id  uuid not null unique references invitations(id) on delete cascade,
  status         text not null default 'in_progress' check (status in ('in_progress', 'completed')),
  task           jsonb not null,                        -- the brief, its facts and the hidden planted mistake
  chat           jsonb not null default '[]'::jsonb,    -- what the candidate and the assistant said
  deliverable    text not null default '',              -- the candidate's final answer
  metrics        jsonb,                                 -- counted by code: prompts, checks, copy share
  review         jsonb,                                 -- evidence notes written after submitting
  started_at     timestamptz not null default now(),
  completed_at   timestamptz,
  created_at     timestamptz not null default now()
);
alter table ai_tasks enable row level security;
