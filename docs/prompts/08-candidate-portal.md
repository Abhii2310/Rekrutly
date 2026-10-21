# Prompt 08 — Candidate portal

Time box: 3 hours. Read ARCHITECTURE section 7 and the `/api/c/*` rows in section 9, DESIGN.md → Candidate portal. This page is what judges will touch on a phone. It must be flawless at 375px.

## Goal

A calm, secure, timed assessment that works in a second browser: personal link, consent, server-owned deadline, autosave, refresh-proof, one submission only.

## Build

1. **Service** `lib/portal/service.ts` (`import 'server-only'`): `resolveInvitation(token)` (hash lookup with explicit columns, joined to assessment title/duration/instructions, job title, candidate first name), and pure helpers (unit-tested): `getPortalState(invitation, now)` → `invalid | expired | revoked | ready | in_progress | time_up | submitted`; `isWithinDeadline(invitation, now, graceSeconds = 30)`; `validateAnswer(question, payload)` (option index within the question's options, text ≤ 5000 chars).
2. **Routes** under `app/api/c/[token]/` (no recruiter session; every route resolves the token first and returns 404 with `{ error: { code: 'invalid_link' } }` for unknown tokens, never revealing whether a token ever existed):
   - `GET /` → state, job title, assessment title, duration, question count, instructions, candidate first name, `serverNow`. First open sets `opened_at`, status `opened`, logs `candidate.opened`.
   - `POST /start` body `{ consent: true }` → if not started: `consent_at`, `started_at = now`, `deadline_at = now + duration`, status `started`, candidate stage `assessment_in_progress`, log `candidate.started`. If already started: return the existing deadline (idempotent). Returns `deadlineAt`, `serverNow`.
   - `GET /questions` → only after start: `id, position, type, prompt, options, max_score, skill` (no keys, explicit select) + saved answers + `deadlineAt` + `serverNow`.
   - `PUT /answers` body `{ questionId, selectedOption?, textAnswer?, currentQuestion }` → checks state is `in_progress` and within deadline+grace, the question belongs to this assessment, validates, upserts, updates `current_question` and `last_activity_at`. Returns `{ savedAt }`.
   - `POST /signals` body `{ events: { type, at }[] }` (max 20 per call) → inserts `integrity_signals`. Never blocks the candidate.
   - `POST /submit` → if already submitted return 409 `already_submitted`; insert the submission (the unique constraint is the real guard; map a unique violation to 409); score MCQ with `lib/scoring/objective.ts` (pure function: correct → max, wrong → 0, unanswered → 0 flagged) into `question_scores` (method `auto`); store objective totals; short-answer questions get no row yet and the submission's `scoring_status` is `pending` if any exist, otherwise `scored`; invitation `submitted` + `submitted_at`; candidate stage `assessment_submitted`; mark `auto_submitted` when after the deadline; log `candidate.submitted` and `score.objective_computed`; update the run's `track_submissions` step result (`submitted` count) and complete it when all invitations are submitted or expired.
3. **Portal UI** (`app/a/[token]/`), its own minimal layout (wordmark top-left, nothing else):
   - **Intro**: "Hi Aarav." (Title), role and assessment title, three quiet facts (duration, question count, "one attempt"), instructions, the consent notice in plain words: what is collected (your answers, start and finish times, and when you switch tabs or paste text), why (to assess your application for this role), that a person reviews the results, that tab switches are shown as signals not proof, and how to ask for deletion (reply to the recruiter). Checkbox "I understand" + primary "Start assessment".
   - **Question screen** per DESIGN.md: progress line, "Question 4 of 10", skill pill, prompt (code blocks in mono on `mist`), MCQ as full-width option rows (keys 1–4 select, Enter goes next), short answer as an auto-growing textarea with a soft character count. Back / Next, and on the last question "Review and submit". A question navigator (small numbered dots: answered filled, current outlined) for jumping around.
   - **Autosave**: MCQ saves immediately, text debounced 600ms and on blur/navigation; footnote shows "Saving…", "Saved", or "Not saved. Retrying…" with exponential retry. Answers survive refresh (restored from `GET /questions`).
   - **Timer**: computed from `deadlineAt` corrected by `serverNow − Date.now()` offset; tabular numbers; warning under 5 minutes, danger under 1; at zero, flush pending saves then auto-submit.
   - **Review and submit**: list of unanswered questions with links, primary "Submit assessment", confirm dialog "You can't change answers after submitting."
   - **Done**: "Submitted." + "Your answers were received at 3:42 pm. You can close this page."
   - **States**: invalid link, expired, time up (submitted automatically), already submitted. Each is one calm sentence and no buttons that do nothing.
   - **Signals**: `visibilitychange` (hidden → `tab_hidden`), `paste` on inputs, `blur` on window; batch and send every 10 seconds and on submit.
   - Works fully on a 375px phone; tap targets ≥44px; no horizontal scroll.

## Constraints

- No recruiter data, no other candidate's data, no answer keys, and no scores are ever returned by `/api/c/*`. Add a unit test that the candidate question select list contains no key fields.
- The portal never shows a score to the candidate.

## Verify (Claude Code)

- `npm run verify` passes with tests for portal state, deadline/grace, answer validation and objective scoring (all branches).
- a browser check (see CLAUDE.md → Browser checks) in two contexts: recruiter copies Aarav's link; candidate context (375px viewport) opens it, consents, answers 3 questions, reloads (answers and timer continue, timer did not reset), answers the rest, submits. Second submit returns the "already submitted" state. A token with one character changed shows the invalid link state. Another candidate's link shows that candidate's name only.
- Recruiter run page shows Aarav as Submitted and the rail shows 1 of 5.
- Screenshot intro, question, review and done at 375px and 1280px; DESIGN.md checklist.

## Finish

Update PROGRESS.md, commit `feat(portal): secure timed assessment with autosave and server deadline`.

## You check

Take the test on your own phone using the deployed URL. If anything feels awkward with your thumb, fix it now.
