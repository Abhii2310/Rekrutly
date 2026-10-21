# Prompt 10 — War Room and follow-ups

Time box: 3 hours. Read ARCHITECTURE sections 3 (follow_up_sweep), 10, 11 and DESIGN.md → Run / War Room.

## Goal

One live screen that shows the whole hiring workflow at a glance (who is where, what's blocked, what needs the recruiter) and a second agent command that prepares follow-ups in English, Hindi or Kannada without ever sending anything on its own.

## Build

1. **Task rules** `lib/tasks/sync.ts`: `syncTasks(runId)` implements the four rules in ARCHITECTURE section 11 with `dedupe_key` upserts (e.g. `follow_up:<invitationId>`). Auto-close tasks whose condition is gone (candidate started → follow-up task `done` with "Resolved automatically"). Throttle to once per 30s per run (store last sync time in the run's plan jsonb or an in-memory map with a DB fallback). Unit-test the rule selection as a pure function over plain data.
2. **Next actions** `lib/tasks/next-actions.ts` (pure, unit-tested): from run state compute up to 4 plain sentences, e.g. "2 candidates haven't started. Send a nudge.", "Diya's report is ready to review.", "Rohan has no email. Share his link on WhatsApp or add an email." Rules only, no model.
3. **Drafts** `lib/ai/followups.ts` + `POST /api/tasks/[id]/draft` body `{ language: 'en' | 'hi' | 'kn' }`: fast model writes a short, warm, professional message (no pressure tactics, no mention of other candidates, includes the deadline if any, signs off as the hiring team) in the chosen language and script (Hindi in Devanagari, Kannada in Kannada script), plus a shorter WhatsApp version. Save into `tasks.draft`; log `followup.drafted`. Never send.
4. **Task actions** `PATCH /api/tasks/[id]` `{ status: 'done' | 'dismissed' }` → logs `task.completed` / `task.dismissed`.
5. **follow_up_sweep intent**: make the planner, plan builder and executor support it end to end. `analyze_pipeline` runs `syncTasks` + next actions and stores them in the step result; `draft_followups` drafts English messages for open follow-up tasks (max 5, in parallel with a concurrency of 3). Both require approval (the plan says "Nothing will be sent. You'll review each message."). The run completes after drafting. Make `POST /api/runs/[id]/approve` intent-aware: this intent needs no assessment, its snapshot lists the steps and the candidates who will get drafts, and the review page for it is a single column (plan, who gets drafts, "Approve and draft messages").
6. **`/live` extension**: include candidate progress rows (name, state, current question / total, seconds left computed on the server, last activity), next actions, open tasks with drafts, and call `syncTasks` (throttled).
7. **War Room** `/runs/[id]/war-room` and the sidebar item (goes to the most recent non-cancelled run, or an EmptyState with a link to the Command Centre):
   - Header: run summary, StatusPill, secondary "Pause" / "Resume" (paused runs show a calm banner "Paused. Rekrutly won't take any new actions until you resume.").
   - Left column: ProgressRail.
   - Right column, top to bottom: "Candidates" live rows in three aligned columns (name; "Question 4 of 10" or state; time left in tabular nums or submitted time) with a small activity dot that pulses once when that row changes; "Next actions" sentences; "Needs you" task list — each task expands to show the draft with a language SegmentedControl (English, हिन्दी, ಕನ್ನಡ), "Copy message", "Open in WhatsApp" (only if a phone exists; `https://wa.me/<digits>?text=<encoded>`), "Copy email" (only if an email exists), "Mark done"; "Activity" receipts.
   - Everything updates through `use-poll` with no layout jumps.
8. **Overview** "Needs your attention" and the Need you stat now use real tasks.

## Constraints

- No automatic sending of any message. The WhatsApp link only opens WhatsApp with text filled in; the recruiter presses send.
- No model call inside `/live`.

## Verify (Claude Code)

- `npm run verify` passes with tests for task rules, auto-close, next actions.
- Live: with `TASK_OVERDUE_MINUTES=2`, after 2 minutes the War Room shows nudge tasks for candidates who haven't started; generate a Hindi draft and a Kannada draft and confirm the script is correct; "Open in WhatsApp" URL is well-formed; one candidate starts the test in another context and their row moves to "Question 1 of 10" within ~2 seconds and their nudge task resolves.
- Command: "Prepare the next hiring steps, identify blockers and draft outstanding follow-ups. Ask me before sending anything." → plan with 2 steps → approve → drafts appear.
- Screenshot the War Room mid-assessment; DESIGN.md checklist.

## Finish

Update PROGRESS.md, commit `feat(war-room): live workflow, tasks, multilingual follow-up drafts`.

## You check

Put the War Room on one side of your screen and a candidate test on the other. Answer a question. That two-screen moment is your demo's heart; it must feel instant and calm.
