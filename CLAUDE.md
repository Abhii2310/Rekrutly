# Rekrutly — instructions for Claude Code

Rekrutly is a glass-box AI hiring agent for small startup hiring teams in India. A recruiter types one instruction. Rekrutly turns it into a visible plan, waits for approval, executes only allowed actions, and keeps a receipt (a timeline event) for everything it does. This is a 48-hour hackathon build. It must work end to end on a real deployed URL, and it must look as calm and precise as an Apple product page.

## The golden path (never break it)

1. Recruiter types: "Prepare a 30-minute full-stack developer assessment for the five candidates in this job. Cover React, APIs, SQL and debugging. Show me the questions before inviting anyone."
2. Rekrutly shows the plan, the generated questions and a preview of what will happen.
3. Recruiter edits one question and approves.
4. Code creates the assessment and one unique link per candidate. The timeline records each step.
5. A candidate opens their link in another browser, answers and submits.
6. The recruiter sees the real score, skill breakdown, evidence and interview questions, updated live.

Once a step of this path exists, every later task must leave it working. Re-run it before calling a task done.

## Read before working

- Backend, database, API or AI work: read `docs/ARCHITECTURE.md` first.
- Any UI work: read `docs/DESIGN.md` first and follow it exactly. Light theme only.
- Status: `docs/PROGRESS.md`. Update it at the end of every task.
- Database source of truth: `supabase/migrations/*.sql`. Never change the schema in place; add a new numbered migration and tell the user to run it in the Supabase SQL Editor.

## Stack (do not swap or add frameworks)

- Next.js 16 App Router, React 19, TypeScript strict. Request interception lives in `proxy.ts` with an exported `proxy` function (Next.js 16 renamed middleware). `cookies()`, `headers()` and route `params` are async.
- Tailwind CSS v4 (tokens via `@theme` in `app/globals.css`) + shadcn/ui components restyled to DESIGN.md. Icons: lucide-react. Animation: motion.
- Supabase Postgres via `@supabase/supabase-js`, used only in server code with the service role key. No Supabase client in the browser.
- AI: Vercel AI SDK v6 (`ai`, with provider packages `@ai-sdk/google` and `@ai-sdk/anthropic`, plus `gateway()` from `ai`). Provider is switched by `AI_PROVIDER`; all model access goes through `lib/ai/client.ts` and no other file imports a provider package. Structured output is `generateText({ model, output: Output.object({ schema }) })` and the result is `.output`. `generateObject` is deprecated: never use it. When unsure, read `node_modules/ai/docs/`.
- Zod v4 for every boundary. Vitest for unit tests. Playwright for the e2e golden-path test.
- npm. Node 20.9+.

## Commands

- `npm run dev` start locally
- `npm run verify` typecheck + lint + unit tests + production build (must pass before every commit)
- `npm run test` unit tests, `npm run e2e` Playwright golden path
- `npm run db:seed` reset and reseed demo data (only rows with `is_demo = true`)
- `npm run db:check` confirm all 15 tables exist; `npm run ai:check` test the configured models, `npm run ai:models` list live model IDs
- `npm run screenshot -- <path> [--width 375] [--name x]` signed-in screenshot to `screenshots/`

## Non-negotiable rules

1. AI proposes, people approve, code executes. Model output never triggers a side effect directly. Every action goes through the allow-list in `lib/executor/actions.ts`. The plan's steps are built by code from a template; the model only supplies parameters and wording.
2. Every model output is parsed with a Zod schema. On failure: retry once with the fast model, then return a typed error the UI can show with a Retry button. The UI never crashes on AI failure.
3. Answer keys and rubrics never leave the server on candidate routes. Candidate queries select explicit columns, never `*`. `question_keys` is only read in `lib/scoring/` and recruiter routes.
4. The service role key is only imported in files that start with `import 'server-only'`.
5. The server owns time. Deadlines are set on the server when a candidate starts and enforced on every save and submit. The browser timer is display only.
6. Every meaningful action writes one `workflow_events` row through `lib/events.ts` (`logEvent`). Events are never edited.
7. Never claim something happened that did not. Email is "sent" only when the provider returns success; otherwise show "Link ready, email not configured". Simulated data is labelled "Simulated" in the UI and flagged in the database.
8. No protected characteristics (age, gender, caste, religion, marital status, pregnancy, disability, ethnicity, nationality) in prompts, filters, scores or rankings. The guardrail in `lib/guardrails/` must run on every instruction.
9. Seeded rows have `is_demo = true` and the UI shows a small "Demo data" tag where they appear.
10. Every visible button works. If a feature is not built, hide the button. No fake loading, no hard-coded numbers in components; all data comes from the database.
11. AI scores are always labelled "Suggested by AI" and can be overridden by the recruiter with a reason. Objective (multiple-choice) scores are computed by plain code.
12. No automatic hiring decisions. Never label a candidate "best" or "recommended hire".

## Code conventions

- Folders: `app/` routes only, `components/ui/` primitives, `components/<feature>/` feature parts, `lib/` all logic (`lib/db`, `lib/ai`, `lib/executor`, `lib/scoring`, `lib/guardrails`, `lib/security`, `lib/events.ts`, `lib/status.ts`, `lib/env.ts`).
- Server Components by default. Add `'use client'` only for interactivity, as low in the tree as possible.
- Reads: Server Components call typed query functions in `lib/db/queries/*`. Writes: Route Handlers in `app/api/**/route.ts`, each validating input with Zod and returning `{ data }` or `{ error: { code, message } }` with the right HTTP status.
- Domain functions return `Result<T> = { ok: true; data: T } | { ok: false; error: AppError }` instead of throwing across layers.
- No `any`. No non-null assertions without a comment. Explicit return types on exported functions in `lib/`.
- Keep files under ~250 lines; split by responsibility.
- All status values, labels and colours come from one map in `lib/status.ts`. Never hard-code a status string in a component.
- Environment variables are read only through `lib/env.ts` (Zod-validated, fails fast with a clear message).
- Live screens poll `GET /api/.../live` every 2 seconds while the tab is visible (`hooks/use-poll.ts`). No websockets.
- Long AI work after a response uses `after()` from `next/server`. AI routes set `export const maxDuration = 60`.

## Definition of done (every task)

1. `npm run verify` passes with zero errors and zero warnings you introduced.
2. New logic in `lib/` has unit tests for the important paths and edge cases.
3. You ran the feature in a browser (see Browser checks below) and checked it against DESIGN.md's review checklist.
4. The golden path still works up to the furthest built step.
5. `docs/PROGRESS.md` updated in three lists: Working, Simulated or demo-only, Not built yet.
6. One commit with a clear message, e.g. `feat(portal): server-enforced deadline and autosave`.

## Browser checks

Use the first that is available: (1) a browser tool in this session (the built-in browser or Claude in Chrome) for clicking through flows and taking screenshots; (2) Playwright MCP if installed; (3) `npm run screenshot`. Look at every screenshot before calling UI work done.

## Never

- Never add LangChain, agent frameworks, vector databases, extra AI providers, state libraries or CSS-in-JS.
- Never use localStorage for app data, `dangerouslySetInnerHTML` with model text, or `eval`.
- Never add dark mode, gradients, glows, emoji in the UI, or decorative animation.
- Never commit `.env.local` or print secrets in logs.
- Never delete or rewrite files outside the task's scope without saying why.

## Working style

- For any task touching more than two files, make a short plan first, then build.
- If a credential, env var or SQL migration is missing, stop and tell the user exactly what to do. Do not invent values or mock around it.
- If something outside the task looks broken, note it in PROGRESS.md under "Not built yet / known issues" instead of silently changing it.
- At the end, report: what you built, how you verified it, anything simulated, and the next prompt to run.
