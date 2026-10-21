# Progress

Claude Code updates this file at the end of every prompt. Keep each list honest and short.

## Last completed prompt

Prompt 02 (data layer and seed). Next: `docs/prompts/03-access-gate-and-ui-kit.md`

## Working (verified end to end)

- Schema from `0001_init.sql` applied to this project's Supabase; `npm run db:check` reports all 15 tables OK.
- Next.js 16.4.2 app with design tokens, validated env (`lib/env-schema.ts`, 12 unit tests), server-only DB client, `/api/health` (db ok locally).
- `npm run verify` passes. `npm run ai:check` passes on Google: smart `gemini-3.5-flash` (~3.5s), fast `gemini-3.5-flash-lite` (~1.7s).
- Home page screenshot checked: one centred line on white.
- Data layer: row types mirroring the SQL, `lib/status.ts` (labels, tones, transitions), `Result`, `logEvent` receipts, invitation token security (hash, AES-256-GCM, tampering fails), typed read queries for jobs, candidates, overview.
- Seed: `npm run db:seed` run twice gives identical counts (3 jobs, 15 candidates, fixed UUIDs, all `is_demo = true`); Rohan Nair has a null email. 28 unit tests pass.

## Simulated or demo-only

- (none yet)

## Not built yet / known issues

- Everything in prompts 03–14.
- `logEvent` and the queries were exercised only through a throwaway script against the real DB (queries) and typecheck (`logEvent`); no UI uses them yet.
- Candidate search matches name, title and company only (not skills).
- Demo seed does not delete old `system.seeded` receipts (they have no run or job), so they accumulate harmlessly.
- Not yet done: GitHub push, Vercel deploy, Vercel env vars, Fluid compute check (user steps).
- Model latency varies a lot: `gemini-3.8-flash` took ~36s and `3.7-flash` ~19s on a trivial call, so smart is set to `3.5-flash`. Re-check with `npm run ai:check` before the demo.
- Scaffold defaults `cacheComponents` and `partialPrefetching` were removed from `next.config.ts` (they conflict with `dynamic = 'force-dynamic'` and the kit's assumptions).
- `npm run screenshot` sign-in step warns with 404 until the login route exists (Prompt 03).
- `next.config.ts` pins `turbopack.root` because a stray `package-lock.json` exists in the home folder.
- shadcn init also added `components/ui/button.tsx`, `input.tsx`, `textarea.tsx`, `input-group.tsx` (dependencies of the requested components); Prompt 03 restyles them.
