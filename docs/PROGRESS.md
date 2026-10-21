# Progress

Claude Code updates this file at the end of every prompt. Keep each list honest and short.

## Last completed prompt

Prompt 03 (access gate and UI kit). Next: `docs/prompts/04-overview-jobs-candidates.md`

## Working (verified end to end)

- Schema from `0001_init.sql` applied to this project's Supabase; `npm run db:check` reports all 15 tables OK.
- Next.js 16.4.2 app with design tokens, validated env (`lib/env-schema.ts`, 12 unit tests), server-only DB client, `/api/health` (db ok locally).
- `npm run verify` passes. `npm run ai:check` passes on Google: smart `gemini-3.5-flash` (~3.5s), fast `gemini-3.5-flash-lite` (~1.7s).
- Home page screenshot checked: one centred line on white.
- Data layer: row types mirroring the SQL, `lib/status.ts` (labels, tones, transitions), `Result`, `logEvent` receipts, invitation token security (hash, AES-256-GCM, tampering fails), typed read queries for jobs, candidates, overview.
- Seed: `npm run db:seed` run twice gives identical counts (3 jobs, 15 candidates, fixed UUIDs, all `is_demo = true`); Rohan Nair has a null email. 28 unit tests pass.

- Access gate: passcode login (`/login`), HMAC session cookie (httpOnly, 7 days), `proxy.ts` protecting all recruiter routes and APIs, `requireRecruiter()` helper. Checked in the browser: signed-out redirect keeps `?next=`, wrong passcode shows the inline error, right passcode lands on the target page, sign out works, `/a/test` is not redirected (404), recruiter API returns 401 when signed out. 6 session unit tests.
- UI kit in `components/ui/` (Button, Input, Textarea, SegmentedControl, StatusPill, AIMark, DemoTag, SimulatedTag, GroupedList, ListRow, Stat, PageHeader, EmptyState, ErrorState, Skeleton, Avatar, Kbd, ProgressRail, Toaster, plus restyled Dialog, Sheet, Tooltip, DropdownMenu, Command, Switch) and `/styleguide` (DEMO_MODE only) showing them in every state. Frame: 240px sidebar that collapses to a 72px icon rail under 1024px; placeholder pages for every nav item.

## Simulated or demo-only

- (none yet)

## Not built yet / known issues

- Everything in prompts 04–14. Nav pages (Overview, Command, Jobs, Candidates, War Room, Analytics) are honest placeholders until their prompts.
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
