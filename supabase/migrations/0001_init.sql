-- Rekrutly schema v1
-- Source of truth for the database. Run once in the Supabase SQL Editor.
-- Never edit this file after it has been applied: add 0002_*.sql instead.
--
-- Design rules
--   * Status columns use CHECK lists (easy to read, easy to extend in a new migration).
--   * The database enforces the important truths: one invitation per candidate per
--     assessment, one submission per invitation, scores never above max.
--   * Answer keys live in question_keys, a separate table that candidate-facing
--     code never selects from.
--   * Row Level Security is ON for every table with NO policies. The browser can
--     never read data directly. All access goes through server code that uses the
--     service role key (which bypasses RLS).

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

create or replace function set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function forbid_update() returns trigger
language plpgsql as $$
begin
  raise exception '% is append-only; updates are not allowed', tg_table_name;
end;
$$;

-- ---------------------------------------------------------------------------
-- Jobs and candidates
-- ---------------------------------------------------------------------------

create table jobs (
  id               uuid primary key default gen_random_uuid(),
  title            text not null check (char_length(title) between 2 and 120),
  team             text,
  location         text,
  employment_type  text,
  description      text not null default '',
  skills           text[] not null default '{}',
  status           text not null default 'open'
                   check (status in ('draft', 'open', 'paused', 'closed')),
  is_demo          boolean not null default false,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- A candidate row represents one person applying to one job (an application).
create table candidates (
  id                uuid primary key default gen_random_uuid(),
  job_id            uuid not null references jobs(id) on delete cascade,
  full_name         text not null check (char_length(full_name) between 2 and 120),
  email             text check (email is null or email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  phone             text,
  current_title     text,
  current_company   text,
  years_experience  numeric(4,1) check (years_experience is null or years_experience >= 0),
  location          text,
  skills            text[] not null default '{}',
  resume_summary    text not null default '',
  source            text,
  stage             text not null default 'applied'
                    check (stage in (
                      'applied', 'assessment_invited', 'assessment_in_progress',
                      'assessment_submitted', 'under_review', 'interview',
                      'offer', 'hired', 'rejected', 'withdrawn')),
  is_demo           boolean not null default false,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index candidates_job_idx on candidates (job_id);
create unique index candidates_job_email_uniq
  on candidates (job_id, lower(email)) where email is not null;

-- ---------------------------------------------------------------------------
-- Agent workflow: runs, steps, events, approvals
-- ---------------------------------------------------------------------------

create table workflow_runs (
  id            uuid primary key default gen_random_uuid(),
  instruction   text not null check (char_length(instruction) between 3 and 2000),
  intent        text not null
                check (intent in ('create_assessment_workflow', 'follow_up_sweep', 'unsupported')),
  job_id        uuid references jobs(id) on delete set null,
  plan          jsonb not null default '{}'::jsonb,  -- validated planner output + resolved params
  status        text not null default 'draft'
                check (status in (
                  'draft', 'awaiting_approval', 'approved', 'executing',
                  'waiting', 'paused', 'completed', 'failed', 'cancelled')),
  error         text,
  is_demo       boolean not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  approved_at   timestamptz,
  completed_at  timestamptz
);

create index workflow_runs_created_idx on workflow_runs (created_at desc);
create index workflow_runs_job_idx on workflow_runs (job_id);

create table workflow_steps (
  id                 uuid primary key default gen_random_uuid(),
  run_id             uuid not null references workflow_runs(id) on delete cascade,
  position           int not null check (position >= 0),
  action             text not null
                     check (action in (
                       'generate_questions', 'create_assessment', 'create_invitations',
                       'send_invitations', 'track_submissions', 'score_and_report',
                       'analyze_pipeline', 'draft_followups')),
  title              text not null,
  params             jsonb not null default '{}'::jsonb,
  requires_approval  boolean not null default false,
  status             text not null default 'planned'
                     check (status in (
                       'planned', 'awaiting_approval', 'queued', 'executing',
                       'waiting', 'completed', 'failed', 'skipped', 'cancelled')),
  result             jsonb,
  error              text,
  attempts           int not null default 0 check (attempts >= 0),
  started_at         timestamptz,
  finished_at        timestamptz,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  unique (run_id, position)
);

create table approvals (
  id           uuid primary key default gen_random_uuid(),
  run_id       uuid not null references workflow_runs(id) on delete cascade,
  decision     text not null check (decision in ('approved', 'cancelled')),
  decided_by   text not null,
  snapshot     jsonb not null,  -- exactly what the recruiter saw when deciding
  note         text,
  created_at   timestamptz not null default now()
);

create index approvals_run_idx on approvals (run_id);

-- ---------------------------------------------------------------------------
-- Assessments, questions, answer keys
-- ---------------------------------------------------------------------------

create table assessments (
  id                uuid primary key default gen_random_uuid(),
  job_id            uuid not null references jobs(id) on delete cascade,
  run_id            uuid references workflow_runs(id) on delete set null,
  title             text not null,
  instructions      text not null default '',
  duration_minutes  int not null check (duration_minutes between 5 and 180),
  skills            text[] not null default '{}',
  status            text not null default 'draft'
                    check (status in ('draft', 'approved', 'live', 'closed', 'archived')),
  is_demo           boolean not null default false,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  published_at      timestamptz
);

create index assessments_job_idx on assessments (job_id);
create index assessments_run_idx on assessments (run_id);

-- What candidates are allowed to see. No answers here.
create table questions (
  id                   uuid primary key default gen_random_uuid(),
  assessment_id        uuid not null references assessments(id) on delete cascade,
  position             int not null check (position >= 0),
  type                 text not null check (type in ('mcq', 'short')),
  prompt               text not null check (char_length(prompt) between 10 and 2000),
  options              jsonb,  -- array of strings for mcq, null for short
  skill                text not null,
  difficulty           text not null check (difficulty in ('easy', 'medium', 'hard')),
  max_score            numeric(5,2) not null check (max_score > 0 and max_score <= 20),
  ai_generated         boolean not null default true,
  edited_by_recruiter  boolean not null default false,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  constraint questions_options_shape check (
    (type = 'mcq'   and options is not null and jsonb_typeof(options) = 'array'
                    and jsonb_array_length(options) between 2 and 6)
    or
    (type = 'short' and options is null)
  )
);

create index questions_assessment_idx on questions (assessment_id, position);

-- The locked drawer. Candidate-facing code must never read this table.
create table question_keys (
  question_id     uuid primary key references questions(id) on delete cascade,
  correct_option  int check (correct_option is null or correct_option between 0 and 5),
  rubric          jsonb,   -- { criteria: [{ point, weight }], model_answer }
  explanation     text,
  constraint question_keys_has_key check (correct_option is not null or rubric is not null)
);

-- ---------------------------------------------------------------------------
-- Invitations, answers, submissions, scores
-- ---------------------------------------------------------------------------

create table invitations (
  id                uuid primary key default gen_random_uuid(),
  assessment_id     uuid not null references assessments(id) on delete cascade,
  candidate_id      uuid not null references candidates(id) on delete cascade,
  token_hash        text not null unique,   -- sha256 of the raw token; used for lookup
  token_encrypted   text not null,          -- aes-256-gcm; lets the recruiter re-copy the link
  status            text not null default 'created'
                    check (status in (
                      'created', 'sent', 'opened', 'started',
                      'submitted', 'expired', 'revoked')),
  delivery_status   text not null default 'not_sent'
                    check (delivery_status in ('not_sent', 'sent', 'failed', 'unconfigured')),
  delivery_error    text,
  expires_at        timestamptz not null,
  consent_at        timestamptz,
  opened_at         timestamptz,
  started_at        timestamptz,
  deadline_at       timestamptz,
  submitted_at      timestamptz,
  current_question  int,
  last_activity_at  timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (assessment_id, candidate_id),
  constraint invitations_deadline_needs_start check (deadline_at is null or started_at is not null),
  constraint invitations_deadline_after_start check (deadline_at is null or deadline_at > started_at)
);

create index invitations_assessment_idx on invitations (assessment_id);
create index invitations_candidate_idx on invitations (candidate_id);

-- One row per question per candidate; autosave upserts into it.
create table answers (
  id               uuid primary key default gen_random_uuid(),
  invitation_id    uuid not null references invitations(id) on delete cascade,
  question_id      uuid not null references questions(id) on delete cascade,
  selected_option  int check (selected_option is null or selected_option between 0 and 5),
  text_answer      text check (text_answer is null or char_length(text_answer) <= 5000),
  saved_at         timestamptz not null default now(),
  unique (invitation_id, question_id)
);

-- The UNIQUE on invitation_id is what makes duplicate submissions impossible.
create table submissions (
  id                  uuid primary key default gen_random_uuid(),
  invitation_id       uuid not null unique references invitations(id) on delete cascade,
  submitted_at        timestamptz not null default now(),
  auto_submitted      boolean not null default false,
  objective_score     numeric(6,2),
  objective_max       numeric(6,2),
  ai_suggested_score  numeric(6,2),
  ai_suggested_max    numeric(6,2),
  final_score         numeric(6,2),   -- after any recruiter overrides
  final_max           numeric(6,2),
  skill_breakdown     jsonb not null default '[]'::jsonb,
  scoring_status      text not null default 'pending'
                      check (scoring_status in ('pending', 'scoring', 'scored', 'failed')),
  scoring_error       text,
  report              jsonb,
  report_status       text not null default 'pending'
                      check (report_status in ('pending', 'generating', 'ready', 'failed')),
  report_error        text,
  is_simulated        boolean not null default false,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create table question_scores (
  id                 uuid primary key default gen_random_uuid(),
  submission_id      uuid not null references submissions(id) on delete cascade,
  question_id        uuid not null references questions(id) on delete cascade,
  method             text not null check (method in ('auto', 'ai_suggested')),
  score              numeric(5,2) not null check (score >= 0),
  max_score          numeric(5,2) not null check (max_score > 0),
  is_correct         boolean,          -- mcq only
  unanswered         boolean not null default false,
  reasoning          text,
  evidence_quote     text,             -- must be an exact substring of the answer
  matched_criteria   jsonb,
  missing_criteria   jsonb,
  confidence         text check (confidence is null or confidence in ('low', 'medium', 'high')),
  overridden_score   numeric(5,2),
  override_reason    text,
  overridden_at      timestamptz,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  unique (submission_id, question_id),
  constraint question_scores_score_le_max check (score <= max_score),
  constraint question_scores_override_range check (
    overridden_score is null or (overridden_score >= 0 and overridden_score <= max_score)),
  constraint question_scores_override_reason check (
    overridden_score is null or (override_reason is not null and char_length(override_reason) >= 3))
);

-- Integrity events are signals, never proof. Shown neutrally to recruiters.
create table integrity_signals (
  id             bigint generated always as identity primary key,
  invitation_id  uuid not null references invitations(id) on delete cascade,
  type           text not null check (type in ('tab_hidden', 'paste', 'window_blur')),
  occurred_at    timestamptz not null default now()
);

create index integrity_signals_invitation_idx on integrity_signals (invitation_id);

-- ---------------------------------------------------------------------------
-- Tasks (follow-up queue) and the event timeline
-- ---------------------------------------------------------------------------

create table tasks (
  id            uuid primary key default gen_random_uuid(),
  run_id        uuid references workflow_runs(id) on delete cascade,
  job_id        uuid references jobs(id) on delete cascade,
  candidate_id  uuid references candidates(id) on delete cascade,
  type          text not null
                check (type in ('follow_up', 'review_submission', 'schedule_interview', 'missing_email', 'custom')),
  title         text not null,
  detail        text,
  status        text not null default 'open' check (status in ('open', 'done', 'dismissed')),
  due_at        timestamptz,
  draft         jsonb,          -- { language, subject, body, whatsapp_text }
  dedupe_key    text unique,    -- makes rule-based task generation idempotent
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  completed_at  timestamptz
);

create index tasks_status_idx on tasks (status, due_at);

-- Append-only receipts. Every meaningful action writes one row.
create table workflow_events (
  id            bigint generated always as identity primary key,
  run_id        uuid references workflow_runs(id) on delete cascade,
  step_id       uuid references workflow_steps(id),   -- no action: steps with receipts cannot be deleted alone
  job_id        uuid references jobs(id) on delete cascade,
  candidate_id  uuid references candidates(id) on delete cascade,
  type          text not null check (type ~ '^[a-z_]+\.[a-z_]+$'),   -- e.g. step.completed
  actor         text not null default 'system'
                check (actor in ('recruiter', 'agent', 'system', 'candidate')),
  level         text not null default 'info' check (level in ('info', 'success', 'warning', 'error')),
  message       text not null,
  data          jsonb not null default '{}'::jsonb,
  is_simulated  boolean not null default false,
  created_at    timestamptz not null default now()
);

create index workflow_events_run_idx on workflow_events (run_id, id);
create index workflow_events_created_idx on workflow_events (created_at desc);

create trigger workflow_events_append_only
  before update on workflow_events
  for each row execute function forbid_update();

-- ---------------------------------------------------------------------------
-- updated_at triggers
-- ---------------------------------------------------------------------------

create trigger jobs_updated_at            before update on jobs            for each row execute function set_updated_at();
create trigger candidates_updated_at      before update on candidates      for each row execute function set_updated_at();
create trigger workflow_runs_updated_at   before update on workflow_runs   for each row execute function set_updated_at();
create trigger workflow_steps_updated_at  before update on workflow_steps  for each row execute function set_updated_at();
create trigger assessments_updated_at     before update on assessments     for each row execute function set_updated_at();
create trigger questions_updated_at       before update on questions       for each row execute function set_updated_at();
create trigger invitations_updated_at     before update on invitations     for each row execute function set_updated_at();
create trigger submissions_updated_at     before update on submissions     for each row execute function set_updated_at();
create trigger question_scores_updated_at before update on question_scores for each row execute function set_updated_at();
create trigger tasks_updated_at           before update on tasks           for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- Lock everything down: RLS on, no policies.
-- ---------------------------------------------------------------------------

alter table jobs              enable row level security;
alter table candidates        enable row level security;
alter table workflow_runs     enable row level security;
alter table workflow_steps    enable row level security;
alter table approvals         enable row level security;
alter table assessments       enable row level security;
alter table questions         enable row level security;
alter table question_keys     enable row level security;
alter table invitations       enable row level security;
alter table answers           enable row level security;
alter table submissions       enable row level security;
alter table question_scores   enable row level security;
alter table integrity_signals enable row level security;
alter table tasks             enable row level security;
alter table workflow_events   enable row level security;
