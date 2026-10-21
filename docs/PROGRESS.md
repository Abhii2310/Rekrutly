# Progress

Claude Code updates this file at the end of every prompt. Keep each list honest and short.

## Last completed prompt

Prompt 05 (Command Centre). Next: `docs/prompts/06-question-builder.md`

## Working (verified end to end)

- Schema from `0001_init.sql` applied to this project's Supabase; `npm run db:check` reports all 15 tables OK.
- Next.js 16.4.2 app with design tokens, validated env (`lib/env-schema.ts`, 12 unit tests), server-only DB client, `/api/health` (db ok locally).
- `npm run verify` passes. `npm run ai:check` passes on Google: smart `gemini-3.5-flash` (~3.5s), fast `gemini-3.5-flash-lite` (~1.7s).
- Home page screenshot checked: one centred line on white.
- Data layer: row types mirroring the SQL, `lib/status.ts` (labels, tones, transitions), `Result`, `logEvent` receipts, invitation token security (hash, AES-256-GCM, tampering fails), typed read queries for jobs, candidates, overview.
- Seed: `npm run db:seed` run twice gives identical counts (3 jobs, 15 candidates, fixed UUIDs, all `is_demo = true`); Rohan Nair has a null email. 28 unit tests pass.

- Access gate: passcode login (`/login`), HMAC session cookie (httpOnly, 7 days), `proxy.ts` protecting all recruiter routes and APIs, `requireRecruiter()` helper. Checked in the browser: signed-out redirect keeps `?next=`, wrong passcode shows the inline error, right passcode lands on the target page, sign out works, `/a/test` is not redirected (404), recruiter API returns 401 when signed out. 6 session unit tests.
- UI kit in `components/ui/` (Button, Input, Textarea, SegmentedControl, StatusPill, AIMark, DemoTag, SimulatedTag, GroupedList, ListRow, Stat, PageHeader, EmptyState, ErrorState, Skeleton, Avatar, Kbd, ProgressRail, Toaster, plus restyled Dialog, Sheet, Tooltip, DropdownMenu, Command, Switch) and `/styleguide` (DEMO_MODE only) showing them in every state. Frame: 240px sidebar that collapses to a 72px icon rail under 1024px; placeholder pages for every nav item.
- Overview (stats, needs attention, active workflows, recent activity), Jobs, Job detail, Candidates with URL-backed filters and search, and a candidate profile sheet (`?c=`) with add-email and allowed-stage changes. `PATCH /api/candidates/[id]` validates with Zod and `assertTransition`, logs `candidate.stage_changed` / `candidate.updated`. Checked in the browser: Rohan Nair email added, stage moved to Interview, both shown in Activity, reload kept the sheet open. API error cases checked with curl (401, 400, 404, 409 twice). 46 unit tests.
- Command Centre (`/command`): `POST /api/agent/plan` runs guardrail, then the planner (Gemini via `lib/ai/client.ts`), then `resolvePlan` (code) and `buildSteps` (code), then creates a draft run with 6 steps and logs `plan.created` (and `guardrail.triggered`). Live checks on the real API: the demo sentence gives `create_assessment_workflow`, 5 candidates, 1 without email, 30 minutes, React/APIs/SQL/Debugging, preview true, 6 steps; "only invite candidates under 30" gives a guardrail notice and a valid plan; "Book a flight to Goa" gives unsupported (no run created); the follow-up sentence gives a 2-step sweep. Plan, guardrail notice, unsupported and clarification screens checked in the browser. `/runs/[id]` shows the run and its steps. 104 unit tests.
- AI client: provider switch, retry on the same provider's fast model then the fallback provider, 429 backoff 2s then 5s, 55s total budget, `ai_provider` / `ai_model` recorded in `plan.created`.

## Simulated or demo-only

- (none yet)

## Not built yet / known issues

- Everything in prompts 06–14. War Room and Analytics are honest placeholders until their prompts.
- "Write the questions" currently just opens `/runs/[id]`; Prompt 06 connects it to question generation.
- Planning latency on the Gemini free tier: 5 to 11s when it works first time, up to ~16s when `gemini-3.5-flash` returns 503 and the call retries on `gemini-3.5-flash-lite` (about 1 in 3 calls in testing). Re-check before the demo; set `AI_FALLBACK_PROVIDER` for more resilience.
- The clarification screen was verified with a stubbed API response (the real planner always found a job in testing).
- Test runs created while building were removed by reseeding.
- Overview, job and run links point to `/runs/[id]`, which is built in Prompt 05; no runs exist yet, so no link is dead.
- Candidate profile "Assessments" shows an empty note until Prompt 09.
- Seed now clears old `system.seeded` receipts so the Overview activity list stays clean.
- Added a token `--color-action-tint` (blue tint) for status pills; DESIGN.md lists no tint for the `action` tone.
- Tertiary text token `ink-3` (#86868B) is below 4.5:1 on white; it is only used for placeholders and chevrons. Rail timestamps use `ink-2`.
- The shadcn `radix-nova` preset installed the `cn` helper package (by shadcn); kept as is.
- Overview and other recruiter pages build as static; DEMO_MODE is read at build time on Vercel, so set it before the first deploy.
- `logEvent` and the queries were exercised only through a throwaway script against the real DB (queries) and typecheck (`logEvent`); no UI uses them yet.
- Candidate search matches name, title and company only (not skills).
- Demo seed does not delete old `system.seeded` receipts (they have no run or job), so they accumulate harmlessly.
- Not yet done: GitHub push, Vercel deploy, Vercel env vars, Fluid compute check (user steps).
- Model latency varies a lot: `gemini-3.8-flash` took ~36s and `3.7-flash` ~19s on a trivial call, so smart is set to `3.5-flash`. Re-check with `npm run ai:check` before the demo.
- Scaffold defaults `cacheComponents` and `partialPrefetching` were removed from `next.config.ts` (they conflict with `dynamic = 'force-dynamic'` and the kit's assumptions).
- `npm run screenshot` sign-in step warns with 404 until the login route exists (Prompt 03).
- `next.config.ts` pins `turbopack.root` because a stray `package-lock.json` exists in the home folder.
- shadcn init also added `components/ui/button.tsx`, `input.tsx`, `textarea.tsx`, `input-group.tsx` (dependencies of the requested components); Prompt 03 restyles them.
