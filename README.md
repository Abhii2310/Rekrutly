# Rekrutly

**The glass-box hiring agent for small startup teams.** A recruiter types one instruction. Rekrutly turns it into a visible plan, waits for a yes, runs only the actions it is allowed to run, and keeps a receipt for every step. It owns the messy middle of hiring: assessments, chasing, scoring and deciding who to interview. Every score shows its evidence, every AI judgement is labelled and can be overridden with a reason, and nothing is ever sent without a person pressing the button.

## How it works

> **AI proposes, people approve, code executes.**

1. **Plan.** The recruiter types an instruction (or speaks it). A guardrail removes protected characteristics first. The model only fills in parameters; the steps themselves come from code templates.
2. **Review.** The plan, the generated questions and a preview of what will happen are shown. The recruiter edits and approves.
3. **Execute.** Approved steps run through an allow-list (`lib/executor/actions.ts`). Nothing else can cause a side effect. Every step writes a receipt.
4. **Candidate.** Each candidate gets a personal link, a plain-language consent notice, a server-timed assessment that autosaves, and a phone-friendly screen.
5. **Evidence.** Multiple-choice answers are scored by code. Written answers get an AI suggestion with the exact quote and the rubric points matched and missing. The recruiter reviews, overrides with a reason, and compares candidates side by side. Rekrutly never picks a winner.
6. **Coordinate.** The War Room shows who is where, what is blocked and what needs the recruiter, and drafts follow-ups in English, Hindi and Kannada. The recruiter copies or opens them in WhatsApp; nothing is sent automatically.

### For the admin

- **Landing page** at the root address (the app lives at `/overview`): an aurora hero, a pinned scroll story of the whole product, and almost no text. Nothing on it is a made-up number.
- **Command Centre, Spotlight (Ctrl or Cmd + K) and voice** to plan in a sentence from anywhere.
- **Roles and candidates:** create a role, import candidates from a CSV (bad rows are listed with the reason, duplicates are skipped), and move people through stages.
- **Activity:** every receipt, filterable, with a CSV export for an audit.
- **Data and privacy:** export everything held about a candidate, or delete a candidate and their data on request; a receipt without their name is kept.
- **Settings:** system status, a one-click AI check that shows which provider answered and how fast, and the keyboard shortcuts.
- **Proctored exams** (opt-in): a live War Room with a camera thumbnail per candidate, alerts with a chime, and a review page that plays the recording with flagged moments on a timeline. See `docs/PROGRESS.md`.
- **Demo Director** (demo mode only) to reset, simulate candidates and check the demo is ready.

## Architecture

- **Next.js 16** (App Router, Turbopack), React 19, TypeScript strict. Server Components read; Route Handlers write.
- **Supabase Postgres**, accessed only from server code with the service-role key. Row-level security is on with no public policies.
- **Vercel AI SDK** behind one file, `lib/ai/client.ts`: provider switch, retry on a faster model, then a fallback provider, rate-limit cooldowns, and a Zod-validated structured output for every call.
- **Executor** (`lib/executor/`): approval gate, idempotent actions, run and step state machines (`lib/status.ts`).
- **Scoring** (`lib/scoring/`): objective scoring and aggregates are pure functions; written-answer grading and reports run after the response with `after()` and never throw into the request.
- **Live screens** poll every 2 seconds (`hooks/use-poll.ts`); `/live` endpoints make one database round trip.
- **Tasks** (`lib/tasks/`): four rules with idempotent upserts, auto-closing when the condition goes away; next actions are rules, not a model.
- **Tailwind CSS v4** tokens, shadcn/ui restyled to `docs/DESIGN.md`, motion, lucide-react. Light theme only.
- **Vitest** for unit tests, **Playwright** for the end-to-end golden path.

More detail: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md), [`docs/DESIGN.md`](docs/DESIGN.md), [`docs/PITCH.md`](docs/PITCH.md).

## Data model

Fifteen tables, defined in [`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql):

`jobs` · `candidates` · `workflow_runs` · `workflow_steps` · `approvals` · `assessments` · `questions` · `question_keys` · `invitations` · `answers` · `submissions` · `question_scores` · `integrity_signals` · `tasks` · `workflow_events`

Answer keys and rubrics live in their own table (`question_keys`) and are read only by scoring code and recruiter routes. `workflow_events` is the append-only receipt log.

## Security and privacy

- **Candidate links** are random 256-bit tokens. Only a SHA-256 hash is used for lookup; the token itself is stored AES-256-GCM encrypted so the recruiter can copy it again. Tokens never appear in logs, receipts or error messages.
- **Server-owned time.** The deadline is set on the server when the candidate starts and enforced on every save and submit (with a 30-second grace). The browser timer is display only.
- **Answer keys isolated.** Candidate routes select explicit columns and never touch `question_keys`; a test checks that no candidate response contains a key, rubric or model answer.
- **No public database access.** The service-role key is used only in `server-only` files. RLS is enabled with no policies.
- **Append-only receipts** for every meaningful action; events are never edited.
- **Guardrails.** Age, gender, marital status, pregnancy, religion and caste, disability, ethnicity and nationality are removed from instructions before the model sees them, and the removal is logged. No protected characteristics in prompts, filters, scores or rankings.
- **Consent notice** in plain words before a candidate starts: what is collected, why, that a person reviews the result, and how to ask for deletion.
- **Signals, not proof.** Tab switches and pastes are disclosed up front, shown to the recruiter as hints, and never treated as evidence.
- **Proctoring is opt-in.** Off by default; the recruiter switches it on per assessment. The candidate sees a plain consent screen and must agree and pass a camera check before the timer can start. Video only, no sound. Faces are counted on the candidate's own device (no video goes to any AI, and there is no identity or emotion analysis). Alerts are worded "Review this moment", never "cheating", and nothing fails automatically. Recordings sit in a private storage bucket, are shown only to a signed-in recruiter through short-lived links, and are deleted when the candidate is deleted. Automatic 30-day expiry is not built yet.
- **No automatic decisions.** AI scores are labelled "Suggested by AI" and overridable with a reason. No "best" or "recommended" labels anywhere.
- **Recruiter access** is a passcode with an httpOnly, SameSite session cookie; every recruiter route checks the session as well as the proxy.
- **Minimal data to the model.** Grading sees the question, rubric and answer, never the candidate's name. Follow-up drafts see a first name, the role, the duration and a date, and the candidate link is added by code afterwards.

## What is real and what is simulated

Real, running on the deployed app with a real database and real AI: planning, question writing, approval and execution, candidate links and the timed portal, objective scoring, AI grading with evidence, reports, overrides, War Room, tasks and follow-up drafts, analytics and compare.

Simulated or demo-only (always labelled):

- **Seeded demo data**: three jobs and fifteen candidates, tagged "Demo data".
- **Demo Director** (only when `DEMO_MODE=true`): simulated candidates answer through the real portal services, but their answers are generated, not written by people. Their submissions and receipts carry `is_simulated` and show a "Simulated" tag.
- **Seed history**: three simulated multiple-choice submissions on a closed Go assessment; their reports are built by code from the real scores.
- **Saved demo plan and questions** (`lib/ai/fallbacks/`): a captured earlier AI run, offered in demo mode when the AI is slow or down, and labelled "Saved".
- **Email**: sent only if a Resend key is configured; otherwise Rekrutly says "Links ready, email not configured". WhatsApp opens with the message filled in; the recruiter presses send.

Full, honest lists (including known limits) are in [`docs/PROGRESS.md`](docs/PROGRESS.md).

### Which AI powered the demo

Google Gemini (`gemini-3-flash-preview` for planning, questions and reports; `gemini-3.1-flash-lite-preview` for grading and drafts) with Groq (`openai/gpt-oss-120b`) as the fallback provider. These ran on free tiers, so **only demo data is sent to the model**: seeded candidates and generated test answers, never real people's data. Provider and models are switched with environment variables; no code change is needed.

## Local setup

Requires Node 20.9 or newer.

1. **Install.** `npm install`
2. **Database.** Create a Supabase project. In the SQL Editor, run [`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql), then [`0002_proctoring.sql`](supabase/migrations/0002_proctoring.sql), then `npm run proctor:setup` (checks the migration and creates the private `proctoring` storage bucket).
3. **Environment.** `cp .env.example .env.local` and fill it in. You need the Supabase URL and service-role key, one AI provider key, a recruiter passcode, `SESSION_SECRET` (`openssl rand -hex 32`), `TOKEN_ENC_KEY` (`openssl rand -base64 32`) and `APP_URL` (`http://localhost:3000`). Set `DEMO_MODE=true` for the demo tools.
4. **Check.** `npm run db:check` (all 15 tables) and `npm run ai:check` (the configured models answer).
5. **Seed.** `npm run db:seed` (add `-- --with-history` for analytics history).
6. **Run.** `npm run dev`, open `http://localhost:3000`, and sign in with your passcode.

## Tests

| Command | What it runs |
|---|---|
| `npm test` | Unit tests (Vitest): tokens, sessions, guardrails, scoring, aggregates, status transitions, task rules, analytics, compare, draft checks |
| `npm run verify` | Typecheck, lint, unit tests and a production build |
| `npm run e2e` | The Playwright golden path and negative cases. Add `E2E_USE_FALLBACK=true` to use the saved plan and questions instead of the live AI. Needs `DEMO_MODE=true` and `RECRUITER_PASSCODE` in `.env.local` |

To run the end-to-end suite against a deployed copy: `PLAYWRIGHT_BASE_URL=https://your-app.vercel.app E2E_USE_FALLBACK=true npm run e2e`.

## Roadmap

- Calendar scheduling for interviews (Google and Outlook).
- ATS integrations (import candidates, write stages back).
- Single sign-on and per-user roles instead of a team passcode.
- DPDP readiness: consent records per candidate, a deletion workflow, data export and breach reporting, ahead of the main obligations in May 2027.
- Email delivery with a verified domain, and WhatsApp Business sending with explicit recruiter approval per message.
- Interview kits that turn reports into structured scorecards.
