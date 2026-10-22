-- Rejection emails, reminders, offer replies and interview self-scheduling.
-- Run once in the Supabase SQL Editor. It only adds things and widens one list; nothing is removed.

-- Rejection emails: when one was sent, so it is never sent twice.
alter table candidates add column if not exists rejection_emailed_at timestamptz;

-- Reminders: when each was sent, so each is sent once.
alter table invitations add column if not exists reminder_sent_at timestamptz;
alter table interviews  add column if not exists reminder_sent_at timestamptz;

-- Interview self-scheduling: the recruiter offers up to three times; the candidate picks one.
alter table interviews add column if not exists proposed_slots jsonb;
alter table interviews drop constraint if exists interviews_status_check;
alter table interviews add constraint interviews_status_check check (status in ('proposed', 'scheduled', 'completed', 'cancelled'));

-- Offer replies: a personal link, and the candidate's answer.
alter table offers add column if not exists token_hash text unique;
alter table offers add column if not exists token_encrypted text;
alter table offers add column if not exists response text check (response in ('accepted', 'declined'));
alter table offers add column if not exists responded_at timestamptz;
