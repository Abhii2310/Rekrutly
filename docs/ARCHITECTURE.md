# Rekrutly architecture

One rule explains the whole system: **AI proposes, people approve, code executes, the database keeps receipts.**

```
Recruiter instruction
  → Guardrail check (code + model flags)
  → Planner (AI) extracts parameters            → validated with Zod
  → Plan builder (code) creates steps from a template, resolves real IDs
  → Question generator (AI)                     → validated with Zod
  → Review & approve (human)                    → approvals row with snapshot
  → Executor (code) runs allow-listed actions   → workflow_events receipts
  → Candidate portal (token) → answers → submit
  → Scoring: code for MCQ, AI suggestion + evidence for short answers
  → Report + interview kit (AI, reviewable)
  → Live screens poll /live endpoints every 2s
```

## 1. Folder structure

```
app/
  (auth)/login/page.tsx
  (recruiter)/layout.tsx                 sidebar frame
  (recruiter)/page.tsx                   Overview
  (recruiter)/jobs/page.tsx, jobs/[id]/page.tsx
  (recruiter)/candidates/page.tsx        list + profile sheet (?c=<id>)
  (recruiter)/command/page.tsx           Command Centre
  (recruiter)/runs/[id]/page.tsx         Plan → Review → Run (one page, three states)
  (recruiter)/runs/[id]/war-room/page.tsx
  (recruiter)/assessments/[id]/results/page.tsx
  (recruiter)/submissions/[id]/page.tsx  candidate report + evidence
  (recruiter)/compare/page.tsx           ?s=<id>,<id>
  (recruiter)/analytics/page.tsx
  (recruiter)/demo/page.tsx              Demo Director (DEMO_MODE only)
  a/[token]/page.tsx                     candidate portal (own layout, no sidebar)
  api/…                                  route handlers (see section 5)
components/ui/                           primitives (DESIGN.md)
components/<feature>/                    command, plan, review, portal, results, war-room, analytics
hooks/use-poll.ts
lib/env.ts                               Zod-validated env (server-only)
lib/env-schema.ts                        parseEnv(), importable by scripts and tests
lib/result.ts                            Result<T>, AppError
lib/format.ts                            dates, relative times, percents (en-IN)
lib/db/server.ts                         import 'server-only'; service-role client
lib/db/types.ts                          row types mirroring the SQL
lib/db/queries/*.ts                      typed reads per feature
lib/db/mutations/*.ts                    typed writes shared by routes and the executor
lib/ai/client.ts                         models, timeout, retry wrapper
lib/ai/schemas.ts                        every AI Zod schema
lib/ai/planner.ts, questions.ts, report.ts, followups.ts
lib/ai/fallbacks/*.json                  saved demo plan and questions (DEMO_MODE)
lib/guardrails/protected.ts
lib/executor/actions.ts                  the allow-list
lib/executor/plan-builder.ts             template → steps
lib/executor/run.ts                      executes steps, logs events
lib/scoring/objective.ts, short-answer.ts (AI grading), aggregate.ts
lib/portal/service.ts                    candidate token resolution and portal rules
lib/security/tokens.ts                   create/hash/encrypt/decrypt invitation tokens
lib/security/session.ts                  recruiter passcode session (HMAC cookie)
lib/security/require-recruiter.ts        guard for recruiter route handlers
lib/events.ts                            logEvent()
lib/status.ts                            every status → label, tone, transitions
lib/tasks/sync.ts, next-actions.ts       rule-based tasks and next actions
lib/demo/*                               seed, simulation (DEMO_MODE only)
lib/features.ts                          server-side feature flags (scope cuts)
proxy.ts                                 protects recruiter routes
scripts/seed.ts, scripts/db.ts           demo data (script-safe client)
tests/unit/*, tests/e2e/golden-path.spec.ts
```

## 2. Data model

The SQL in `supabase/migrations/0001_init.sql` is the source of truth. Mirror it by hand in `lib/db/types.ts`.

| Table | Purpose |
|---|---|
| jobs | Open roles. `skills text[]`. |
| candidates | One application = one person for one job. Stage lives here. Email optional. |
| workflow_runs | One per instruction. `plan` jsonb holds validated planner output + resolved IDs. |
| workflow_steps | Ordered actions of a run. Their statuses drive the Progress Rail. |
| approvals | The human decision, with a snapshot of exactly what was shown. |
| assessments | Title, instructions, duration, status. Linked to job and run. |
| questions | Candidate-visible content only. |
| question_keys | Correct option / rubric. Locked drawer. |
| invitations | One per candidate per assessment. Token hash + encrypted token. Server-owned timing. |
| answers | Autosaved, one per question per invitation (upsert). |
| submissions | One per invitation (unique). Scores, skill breakdown, report. |
| question_scores | Per-question score with method, evidence, overrides. |
| integrity_signals | Tab hidden / paste / blur. Signals, never verdicts. |
| tasks | Follow-up queue with drafts; `dedupe_key` keeps rule generation idempotent. |
| workflow_events | Append-only receipts. `type` is `noun.verb`, e.g. `step.completed`. |

### Status machines (enforce transitions in code, see `lib/status.ts`)

- **workflow_runs**: draft → awaiting_approval → approved → executing → waiting → completed. Any → failed. draft/awaiting_approval → cancelled. executing/waiting ↔ paused.
- **workflow_steps**: planned → awaiting_approval → queued → executing → completed | failed | skipped. `track_submissions` sits in `waiting` until every invitation is submitted or expired.
- **assessments**: draft → approved → live → closed.
- **invitations**: created → sent (only if email succeeded) → opened → started → submitted. Also expired, revoked.
- **candidates.stage** moves with invitations: assessment_invited → assessment_in_progress → assessment_submitted → under_review (when the recruiter opens the report) → interview/offer/hired/rejected (recruiter only, never automatic).

## 3. The executor (the vending machine)

`lib/executor/actions.ts` exports a registry. Nothing else may perform workflow side effects.

```ts
type ActionName =
  | 'generate_questions' | 'create_assessment' | 'create_invitations'
  | 'send_invitations' | 'track_submissions' | 'score_and_report'
  | 'analyze_pipeline' | 'draft_followups';

interface ActionDef<P> {
  name: ActionName;
  title: (p: P) => string;          // human words shown in the Progress Rail
  paramsSchema: z.ZodType<P>;
  requiresApproval: boolean;
  run: (ctx: ExecContext, params: P) => Promise<Result<unknown>>;
}
```

Rules for every action:
1. Validate params with its schema.
2. Be idempotent: running twice must not duplicate rows. Use unique constraints and upserts; check "already done" first.
3. Set the step to `executing`, increment `attempts`, log `step.started`.
4. On success: store `result`, set `completed` (or `waiting`), log `step.completed` with a plain-English message ("Created 5 candidate links").
5. On failure: store `error`, set `failed`, set the run to `failed`, log `step.failed`. The UI shows a Retry button calling `POST /api/runs/[id]/steps/[stepId]/retry`.
6. Refuse to run if the run is `paused` or `cancelled`, or if `requiresApproval` and no approvals row with `decision = 'approved'` exists for the run. One approval covers every approval-requiring step listed in its snapshot; a step added after approval needs a new approval.

### Plan templates (built by code, not by the model)

- `create_assessment_workflow`: generate_questions → create_assessment (approval) → create_invitations (approval) → send_invitations (approval; skipped with a clear result when email is not configured) → track_submissions → score_and_report.
- `follow_up_sweep`: analyze_pipeline → draft_followups. Nothing is sent; drafts are copied or opened in WhatsApp by the recruiter.
- `unsupported`: no steps. Show what Rekrutly can do today.

## 4. AI layer

Provider and models come from env: `AI_PROVIDER` (`gateway | google | anthropic | groq`), optional `AI_FALLBACK_PROVIDER` (must differ), `AI_MODEL_SMART` for planning, questions and reports, `AI_MODEL_FAST` for grading, drafts and retries, optional `AI_FALLBACK_MODEL`. Model IDs are never hard-coded: `npm run ai:check` picks them from the provider's live list.

All model access goes through `lib/ai/client.ts`: `getModel(tier, provider?)` builds `gateway(id)`, `google(id)`, `anthropic(id)` or `groq(id)`. No other file imports a provider package. `runStructured` wraps calls with a 45s timeout via AbortSignal, Zod parse and a typed `AiError` (`timeout | invalid_output | provider_error | guardrail`). On timeout or `provider_error` it retries once on the same provider's fast model, then once on the fallback provider if set. On HTTP 429 it backs off 2s then 5s. The answering provider is recorded in event data as `ai_provider`. Parallel AI calls run with concurrency 3, or 1 when the active provider is `google` (free-tier limits).

Data rule: on the Google free tier, only `is_demo` data may be sent to the model (the README must say so).

All prompts: put rules in `system`, data in `prompt`, ask for nothing outside the schema, temperature 0.2 for planning/grading and 0.6 for question writing. Never send protected attributes; candidate data sent to the model is limited to name, skills, experience and resume summary.

### Schemas (write these exactly in `lib/ai/schemas.ts`)

```ts
PlannerOutput = z.object({
  intent: z.enum(['create_assessment_workflow', 'follow_up_sweep', 'unsupported']),
  job_id: z.string().uuid().nullable(),
  candidate_ids: z.array(z.string().uuid()).max(50),
  assessment: z.object({
    title: z.string().min(3).max(120),
    duration_minutes: z.number().int().min(5).max(180),
    question_count: z.number().int().min(3).max(20),
    skills: z.array(z.string().min(1).max(40)).min(1).max(8),
    question_types: z.array(z.enum(['mcq', 'short'])).min(1),
    difficulty: z.enum(['easy', 'medium', 'hard', 'mixed']),
  }).nullable(),
  preview_before_invite: z.boolean(),
  clarifications: z.array(z.object({ field: z.string(), question: z.string().max(200) })).max(3),
  guardrail_flags: z.array(z.object({ phrase: z.string(), reason: z.string().max(200) })),
  assumptions: z.array(z.string().max(160)).max(5),
  summary: z.string().max(280),        // one plain sentence shown above the plan
});

GeneratedQuestion = z.discriminatedUnion('type', [
  z.object({ type: z.literal('mcq'), prompt: z.string().min(10).max(1200),
    options: z.array(z.string().min(1).max(300)).length(4),
    correct_option: z.number().int().min(0).max(3),
    explanation: z.string().max(400),
    skill: z.string(), difficulty: z.enum(['easy', 'medium', 'hard']),
    max_score: z.number().min(1).max(5) }),
  z.object({ type: z.literal('short'), prompt: z.string().min(10).max(1200),
    rubric: z.object({
      criteria: z.array(z.object({ point: z.string().max(200), weight: z.number().min(1).max(5) })).min(2).max(5),
      model_answer: z.string().max(1200) }),
    skill: z.string(), difficulty: z.enum(['easy', 'medium', 'hard']),
    max_score: z.number().min(2).max(10) }),
]);
QuestionSet = z.object({ questions: z.array(GeneratedQuestion).min(3).max(20) });
// Note: Gemini returns HTTP 400 for minItems/maxItems on an array of these objects. The schema sent to the
// model uses an unbounded array (lib/ai/questions.ts); count limits are enforced by postValidate.

ShortAnswerGrade = z.object({
  score: z.number().min(0),                          // clamp to max_score in code
  matched_criteria: z.array(z.string()),
  missing_criteria: z.array(z.string()),
  evidence_quote: z.string().max(300),               // must be an exact substring of the answer
  reasoning: z.string().max(400),
  confidence: z.enum(['low', 'medium', 'high']),
});

CandidateReport = z.object({
  summary: z.string().max(500),
  strengths: z.array(z.object({ skill: z.string(), evidence: z.string().max(300) })).max(4),
  gaps: z.array(z.object({ skill: z.string(), evidence: z.string().max(300) })).max(4),
  interview_questions: z.array(z.object({
    skill: z.string(), question: z.string().max(300), what_good_looks_like: z.string().max(300) })).min(3).max(6),
  missing_evidence: z.array(z.string().max(200)).max(4),
});

FollowUpDraft = z.object({
  language: z.enum(['en', 'hi', 'kn']),
  subject: z.string().max(120),
  body: z.string().max(1200),
  whatsapp_text: z.string().max(600),
});
```

### Post-validation in code (the model is never trusted alone)

- Planner: every `job_id`/`candidate_ids` must exist and belong together; unknown IDs are dropped and become a clarification. If the instruction says "these five" and the job has exactly five candidates in `applied`, select them. If `question_count` was not stated, default 10; duration default 30. Record defaults in `assumptions` so the UI shows them.
- Questions: the generated count must equal the requested count (otherwise trim or request the shortfall once). Skills must come from the requested list. MCQ answers are evenly distributed across A–D (shuffle options in code and remap `correct_option`).
- Grades: clamp `score` to `[0, max_score]`; if `evidence_quote` is not an exact substring of the answer, set it to null and lower confidence to `low`.
- Report: shown with the "Suggested by AI" mark and the evidence it used.

### Fallback

`lib/ai/fallbacks/` holds one saved planner output and one saved question set for the demo job, captured from a real successful run (Prompt 11). When an AI call fails in DEMO_MODE, the UI offers "Use saved demo plan", which is labelled "Saved" everywhere it appears and logged as `plan.fallback_used`.

## 5. Guardrails

`lib/guardrails/protected.ts` runs on every instruction before the model is called and again on the planner's `guardrail_flags`.

- Code check: case-insensitive word-boundary matches for protected terms (age, years old, young, gender, male, female, men, women, married, unmarried, pregnant, religion, hindu, muslim, christian, sikh, jain, caste, dalit, brahmin, disability, disabled, ethnicity, nationality) and comparison phrases attached to age ("under 30 years", "below 25", "older than 40") — but NOT durations or counts ("30-minute", "under 30 minutes", "10 questions").
- If triggered: the plan still builds for the legitimate parts; the flagged part is dropped, the UI shows a calm notice with the reason, and `guardrail.triggered` is logged.
- Unit tests must cover: "only invite candidates under 30" (flag), "only women" (flag), "30-minute assessment" (no flag), "under 30 minutes" (no flag), "5 candidates" (no flag).

## 6. Scoring

- MCQ (`lib/scoring/objective.ts`): pure function. Correct → `max_score`, wrong → 0, unanswered → 0 with `unanswered = true`. 100% unit-tested.
- Short answer (`lib/scoring/short-answer.ts`): empty answer → 0, unanswered, no model call. Otherwise the fast model grades against the rubric → `method = 'ai_suggested'`.
- Aggregate (`lib/scoring/aggregate.ts`): objective score/max, AI-suggested score/max, final (uses overrides when present), and `skill_breakdown = [{ skill, score, max, percent, question_ids }]`.
- Flow on submit: in the request, save the submission and the objective scores synchronously (fast). Then `after()` runs AI grading, aggregate, and the report; statuses move `scoring → scored` and `generating → ready`. Failures set `failed` with an error and a "Retry scoring" button.

## 7. Candidate portal security

- Token: 32 random bytes → base64url (43 chars). Store `sha256(token)` hex in `token_hash` for lookup and `aes-256-gcm(token)` with `TOKEN_ENC_KEY` in `token_encrypted` so the recruiter can copy the link again. Raw tokens are never logged.
- Link: `${APP_URL}/a/${token}`. Expiry: 7 days.
- Every candidate API resolves the invitation by hash, then checks: not expired, not revoked, not submitted (for writes), the question belongs to the invitation's assessment, and `now() <= deadline_at + 30s grace`.
- Start sets `started_at = now()` and `deadline_at = now() + duration` only if not already started (idempotent; refreshing never resets the timer).
- Consent: before starting, the candidate sees what is collected (answers, timing, tab-switch and paste signals), why, and that they can ask for deletion. Store `consent_at`.
- Questions endpoint returns only: id, position, type, prompt, options, max_score, skill.
- After the deadline the client auto-submits; the server also accepts a late submit within grace and marks `auto_submitted`.

## 8. Recruiter access gate

Single recruiter, passcode-based (production would use SSO). `POST /api/auth/login` compares `RECRUITER_PASSCODE` with `crypto.timingSafeEqual`, then sets an httpOnly, secure, sameSite=lax cookie `rk_session = <expiresAtMs>.<hmacSHA256(expiresAtMs, SESSION_SECRET)>` for 7 days. `proxy.ts` (Node runtime) verifies it on every route except `/login`, `/api/auth/*`, `/a/*`, `/api/c/*`, Next static assets and favicon. Recruiter API routes also verify the session (defence in depth).

## 9. API routes

| Method + path | Who | Does |
|---|---|---|
| POST /api/auth/login, POST /api/auth/logout | public | session cookie |
| POST /api/agent/plan | recruiter | guardrail → planner → plan builder → create run (status draft) |
| POST /api/runs/[id]/questions | recruiter | generate (or regenerate all) questions into a draft assessment |
| POST /api/questions/[id]/regenerate | recruiter | regenerate one question, same skill/type |
| PATCH /api/questions/[id], DELETE /api/questions/[id], POST /api/assessments/[id]/questions | recruiter | edit, delete, add |
| PATCH /api/assessments/[id] | recruiter | title, duration, instructions |
| POST /api/runs/[id]/approve | recruiter | approvals row + run executor |
| POST /api/runs/[id]/cancel, /pause, /resume | recruiter | run control |
| POST /api/runs/[id]/steps/[stepId]/retry | recruiter | retry a failed step |
| GET /api/runs/[id]/live | recruiter | run, steps, invitation summary, last 30 events, open tasks |
| GET /api/invitations/[id]/link | recruiter | decrypt and return the candidate link |
| POST /api/submissions/[id]/rescore | recruiter | retry AI grading/report |
| PATCH /api/question-scores/[id] | recruiter | override with reason (logs `score.overridden`) |
| PATCH /api/tasks/[id], POST /api/tasks/[id]/draft | recruiter | complete/dismiss, generate draft in en/hi/kn |
| PATCH /api/candidates/[id] | recruiter | stage change, add email |
| GET /api/c/[token] | candidate | assessment intro + status (no questions before start) |
| POST /api/c/[token]/start | candidate | consent + start timer |
| GET /api/c/[token]/questions | candidate | safe question list + saved answers |
| PUT /api/c/[token]/answers | candidate | upsert one answer, update current_question + last_activity_at |
| POST /api/c/[token]/signals | candidate | integrity signal |
| POST /api/c/[token]/submit | candidate | create submission (unique), objective score, `after()` AI scoring |
| POST /api/demo/reset, POST /api/demo/simulate | recruiter + DEMO_MODE | Demo Director |

## 10. Live updates

`hooks/use-poll.ts`: fetch every 2000ms while `document.visibilityState === 'visible'`, abort in-flight requests on unmount, keep the last good data on error and show a quiet "Reconnecting" note after 3 failures. The War Room and run page use it. The candidate portal sends `current_question` with each autosave, so the recruiter sees "Question 4 of 10".

## 11. Tasks (rule-based, idempotent)

`lib/tasks/sync.ts` runs at most every 30s per run when `/live` is called. Rules (each upserts by `dedupe_key`):
- Invitation not started after `TASK_OVERDUE_MINUTES` (default 60; demo 2) → `follow_up` "Nudge {name} to start".
- Candidate in the run without email → `missing_email`.
- Submission scored and not yet reviewed → `review_submission`.
- Recruiter moves a candidate to `interview` → `schedule_interview`.
Drafts are generated on demand (`FollowUpDraft`), never sent automatically. The model-facing draft schema has no length limits (strict providers reject long output); `lib/ai/followup-rules.ts` enforces them, checks the script (Devanagari for Hindi, Kannada script for Kannada) and the candidate link is appended by code. `follow_up_sweep` targets the latest approved assessment run; its steps store `targetRunId` at approval. WhatsApp uses `https://wa.me/<digits>?text=<encoded>`; the recruiter presses send in WhatsApp.

## 12. Email (optional)

If `RESEND_API_KEY` is set, `send_invitations` sends via Resend and sets `delivery_status = 'sent'` only on success (idempotency key = invitation id). Without a verified domain Resend's test sender only delivers to the account owner's email, so the demo sends to `DEMO_CANDIDATE_EMAIL` only and marks the others `unconfigured`. Without a key, the step completes as "Links ready, email not configured".

## 13. Demo mode

`DEMO_MODE=true` enables `/demo`, the saved-plan fallback, and simulation. Reset deletes demo rows only (`delete from workflow_runs where is_demo; delete from jobs where is_demo;` cascades) and reseeds. Simulation submits answers for chosen invitations through the same submission service, flagging `is_simulated` on submissions and events.

## 14. Environment variables (`lib/env.ts`)

`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `AI_PROVIDER`, `AI_FALLBACK_PROVIDER?`, `AI_GATEWAY_API_KEY?`, `GOOGLE_GENERATIVE_AI_API_KEY?`, `ANTHROPIC_API_KEY?`, `GROQ_API_KEY?` (only the keys for providers in use are required), `AI_MODEL_SMART?`, `AI_MODEL_FAST?`, `AI_FALLBACK_MODEL?`, `RECRUITER_PASSCODE`, `SESSION_SECRET` (≥32 chars), `TOKEN_ENC_KEY` (base64 of 32 bytes), `APP_URL`, `DEMO_MODE`, `DEMO_CANDIDATE_EMAIL?`, `DEMO_CANDIDATE_WHATSAPP?`, `TASK_OVERDUE_MINUTES?`, `RESEND_API_KEY?`, `EMAIL_FROM?`.

## 15. Testing

- Unit (Vitest): tokens (round-trip, hash lookup), session (valid, expired, tampered), guardrails (cases above), objective scoring, aggregate, evidence-substring check, status transitions, plan builder, Zod schemas with good and bad fixtures, deadline logic with fake timers.
- E2E (Playwright, one spec): login → command → plan → generate questions (fallback allowed) → edit one → approve → copy link → new context opens link → consent → answer all → submit → recruiter results show the submission.
