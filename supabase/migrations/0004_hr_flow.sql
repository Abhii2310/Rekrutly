-- The rest of the hiring flow: resume match and shortlist, interviews with a live room, and offer letters.
-- Run once in the Supabase SQL Editor. It only adds things; nothing existing is removed or changed.

-- 1. Resume text, its match against the role, and the recruiter's shortlist decision.
alter table candidates add column if not exists resume_text text;
alter table candidates add column if not exists resume_match jsonb;
alter table candidates add column if not exists shortlisted boolean not null default false;

-- 2. Interviews. The candidate joins through a personal link, like the assessment; the room name cannot be guessed.
create table if not exists interviews (
  id               uuid primary key default gen_random_uuid(),
  candidate_id     uuid not null references candidates(id) on delete cascade,
  job_id           uuid not null references jobs(id) on delete cascade,
  scheduled_at     timestamptz not null,
  duration_minutes integer not null default 30 check (duration_minutes between 10 and 180),
  room             text not null,
  meeting_url      text not null,
  token_hash       text not null unique,
  token_encrypted  text not null,
  status           text not null default 'scheduled' check (status in ('scheduled', 'completed', 'cancelled')),
  notes            text not null default '',
  scorecard        jsonb,
  email_status     text not null default 'not_sent' check (email_status in ('not_sent', 'sent', 'failed')),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index if not exists interviews_candidate_idx on interviews (candidate_id, scheduled_at);
alter table interviews enable row level security;

-- 3. Offer letters. A draft is written by a person or suggested by AI; only a person approves and sends it.
create table if not exists offers (
  id            uuid primary key default gen_random_uuid(),
  candidate_id  uuid not null references candidates(id) on delete cascade,
  job_id        uuid not null references jobs(id) on delete cascade,
  title         text not null,
  compensation  text not null default '',
  start_date    date,
  body          text not null,
  status        text not null default 'draft' check (status in ('draft', 'sent')),
  sent_at       timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists offers_candidate_idx on offers (candidate_id, created_at);
alter table offers enable row level security;
