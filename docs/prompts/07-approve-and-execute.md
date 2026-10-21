# Prompt 07 — Approve and execute

Time box: 3 hours. Read ARCHITECTURE sections 3, 7, 9, 10 and 12, DESIGN.md → Review and approve (right column) and Run / War Room (Progress Rail).

## Goal

The human approval gate, the allow-listed executor, and a live run page where the Progress Rail fills in from real database events. After this prompt the Day 1 test passes.

## Build

1. **Executor** `lib/executor/actions.ts` and `lib/executor/run.ts` exactly per ARCHITECTURE section 3 (registry, param schemas, idempotency, step and run status updates, receipts, refusal rules). `executeRun(runId)` runs approved steps in order and stops at the first failure or at a `waiting` step.
2. **Actions in this prompt:**
   - `create_assessment`: draft → approved → live, `published_at`; result `{ assessmentId }`.
   - `create_invitations`: for each selected candidate, create a token with `lib/security/tokens.ts`, insert the invitation (`expires_at` = now + 7 days) using the unique `(assessment_id, candidate_id)` to stay idempotent, move the candidate to `assessment_invited`, log `invitation.created` per candidate (never log the token). Result `{ created, skipped }`.
   - `send_invitations`: if email is not configured → step `skipped`, every invitation `delivery_status = 'unconfigured'`, log `email.unconfigured` "Links ready. Email isn't configured, so copy links instead." If configured → send with Resend (idempotency key = invitation id) only to candidates with email; when using `onboarding@resend.dev` send only to `DEMO_CANDIDATE_EMAIL` and mark others `unconfigured`; when using that test sender and `DEMO_CANDIDATE_EMAIL` is empty, send nothing, mark all invitations `unconfigured`, and skip the step with the result "Email uses Resend's test sender, which only delivers to your own address. Set DEMO_CANDIDATE_EMAIL to receive one."; set `sent` only on provider success; `failed` with the error otherwise.
   - `track_submissions`: sets the step to `waiting` with result `{ total, submitted: 0 }`; the run becomes `waiting`.
3. **Approval** `POST /api/runs/[id]/approve`: recruiter required; body `{ durationMinutes, recipientIds }` validated; the run must be `awaiting_approval` (or `draft` with questions ready) and the assessment must have ≥3 questions. Apply the chosen duration to the assessment and keep only the chosen recipients in the run's params before executing. Persist an `approvals` row whose `snapshot` contains question count, question ids, duration, recipients (id, name, has_email), invitation preview text and the step list. Log `approval.granted` (actor recruiter). Then `executeRun`. Also `POST /cancel` (logs `approval.cancelled`, run `cancelled`), `POST /pause`, `POST /resume`, `POST /steps/[stepId]/retry`.
4. **Live endpoint** `GET /api/runs/[id]/live`: run, steps, assessment summary, invitations (candidate name, status, delivery status, current question, deadline, submitted), last 30 events, open tasks (empty for now). Small, fast, explicit columns.
5. **Links** `GET /api/invitations/[id]/link`: recruiter-only; decrypts and returns `${APP_URL}/a/${token}`. Log `invitation.link_copied` (no token in the event).
6. **`hooks/use-poll.ts`** per ARCHITECTURE section 10.
7. **Review page, right column** (sticky summary while `awaiting_approval`): duration stepper (5-minute steps, 10–120), recipients list with checkboxes (default all), "No email, link only" notes and inline "Add email", invitation preview (a fixed template with the candidate's first name, role, duration and "Your link is personal. Please don't share it."), "What happens next" generated from the steps, primary "Approve and create links", plain "Cancel".
8. **Run page after approval:** two columns. Left: ProgressRail driven by `/live` (new steps animate per DESIGN.md). Right: "Candidate links" GroupedList — name, delivery state ("Email sent", "Copy link"), StatusPill, buttons "Copy link" (copies and toasts "Link copied") and "Open" (new tab). Below: "Activity" receipts list (message, actor, time) updating live. Failed step shows the error inline with "Retry".
9. A smoke script `scripts/smoke-executor.ts` (the `smoke:executor` entry in `package.json` already exists from Prompt 01) that, against the dev database: creates a demo run, approves it twice, and asserts invitations are not duplicated and receipts are correct. Then cleans up its own rows.

## Constraints

- Nothing in this prompt calls the model.
- Approving twice, refreshing mid-execution, or retrying a step must never create duplicates.

## Verify (Claude Code)

- `npm run verify` and `npm run smoke:executor` pass.
- a browser check (see CLAUDE.md → Browser checks), full Day 1 test: login → command → demo sentence → Write the questions → edit one → Approve and create links → rail shows created, links, email skipped (or sent), and "In progress: waiting for 0 of 5" → Copy link → open it in a new context: the page may 404 (portal is Prompt 08) but the URL is `/a/<43-char token>`.
- Screenshot review and run states; DESIGN.md checklist.

## Finish

Update PROGRESS.md, commit `feat(executor): approval gate, allow-listed executor, live run page`. Tell the user to push and confirm the Day 1 test on the Vercel URL.

## You check

Do the Day 1 test on the deployed URL in a fresh browser. Then sleep.
