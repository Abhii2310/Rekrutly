# Prompt 02 — Data layer and seed

Time box: 90 minutes. Read `docs/ARCHITECTURE.md` sections 2, 7 and 13, and the full SQL in `supabase/migrations/0001_init.sql`.

## Goal

Typed access to every table, one source of truth for statuses, the receipt writer, the token security helpers, and realistic fictional demo data that can be reset at any time.

## Build

1. **Row types.** `lib/db/types.ts`: a `Row` and `Insert` type for every table, mirroring the SQL exactly (nullable columns are `| null`, numerics are `number`, jsonb columns get precise types such as `QuestionOptions = string[]`, `Rubric = { criteria: { point: string; weight: number }[]; model_answer: string }`, `SkillBreakdown = { skill: string; score: number; max: number; percent: number; question_ids: string[] }[]`).
2. **Status map.** `lib/status.ts`: for every status column, export the allowed values as `as const` arrays, a `label` (sentence case, recruiter words), a `tone` (`neutral | action | success | warning | danger | ai`), and the allowed transitions from ARCHITECTURE section 2. Export `canTransition(kind, from, to)` and `assertTransition(...)` returning a `Result`. Labels to use, among others: `awaiting_approval` → "Waiting for you", `waiting` → "In progress", `assessment_invited` → "Invited", `assessment_submitted` → "Submitted", `under_review` → "In review", `unconfigured` → "Email not configured".
3. **Result type.** `lib/result.ts`: `Result<T>`, `AppError = { code: string; message: string; details?: unknown }`, helpers `ok()`, `err()`.
4. **Receipts.** `lib/events.ts`: `logEvent({ runId?, stepId?, jobId?, candidateId?, type, actor, level?, message, data?, isSimulated? })`. Validates `type` against `/^[a-z_]+\.[a-z_]+$/`. Never throws to callers: on insert failure it logs to the server console and returns `err`. Also export the list of event types used across the app as a typed union.
5. **Token security.** `lib/security/tokens.ts`: `createInvitationToken()` → `{ token, hash, encrypted }` (32 random bytes, base64url; `sha256` hex; AES-256-GCM with a random 12-byte IV, stored as `base64url(iv).base64url(tag).base64url(ciphertext)`), `hashToken(token)`, `decryptToken(encrypted)`. Use `node:crypto` only. Unit tests: round trip, different tokens each call, tampered ciphertext fails, hash is stable.
6. **Queries.** `lib/db/queries/jobs.ts` (`listJobs()` with candidate counts per stage, `getJob(id)`), `candidates.ts` (`listCandidates({ jobId?, stage?, search? })`, `getCandidate(id)` with recent events), `overview.ts` (`getOverviewStats()`: total candidates, candidates in assessment_in_progress, completion rate = submitted invitations / invitations, open task count). All `import 'server-only'`, typed returns, explicit column lists.
7. **Seed.** `scripts/seed.ts`, safe to run any number of times:
   - Delete demo rows only: `workflow_runs where is_demo`, then `jobs where is_demo` (cascades handle the rest). Never touch non-demo rows.
   - Insert three demo jobs and their candidates (all `is_demo = true`, fictional people, fictional companies, emails on `example.com`). Give every seeded job and candidate a **fixed, hard-coded UUID** written in the seed file, so saved demo fallbacks (Prompt 11) and bookmarks stay valid after any reset:
     - **Full-Stack Developer**, Engineering, Bengaluru (hybrid), skills React, TypeScript, Node.js, REST APIs, PostgreSQL, Debugging. Five candidates, all `applied`:
       - Aarav Mehta, Frontend Engineer at Lumen Pay, 4 yrs, Bengaluru, React, TypeScript, Next.js, REST APIs. Email = `DEMO_CANDIDATE_EMAIL` if set, else `aarav.mehta@example.com`; phone = `DEMO_CANDIDATE_WHATSAPP` if set.
       - Diya Raghunathan, Backend Engineer at Kestrel Logistics, 6 yrs, Chennai, Node.js, PostgreSQL, API design, Redis.
       - Kabir Shetty, Junior Developer at Brightloop, 2 yrs, Mangaluru, React, JavaScript, CSS.
       - Ishita Banerjee, Full-Stack Engineer at Orbitly, 5 yrs, Pune, React, Node.js, SQL, Docker.
       - Rohan Nair, Software Engineer at Tidewater Labs, 3 yrs, Kochi, Python, Django, React, SQL. **No email** (this shows the "link only" case in the demo).
     - **Product Designer**, Design, Bengaluru, skills Interaction design, Figma, User research, Prototyping. Six candidates across stages: 2 applied, 2 interview, 1 offer, 1 rejected.
     - **Backend Engineer (Go)**, Engineering, Remote (India), skills Go, PostgreSQL, Distributed systems, Kubernetes. Four candidates: 2 applied, 1 under_review, 1 interview.
   - Each candidate gets a two-sentence, specific `resume_summary` and realistic skills. Use names from different regions of India. No ages, photos, gender, religion or caste anywhere.
   - Log one `system.seeded` event (no run) with counts.
   - Print a summary table and exit with code 1 on any error.

## Constraints

- No UI in this prompt.
- Seed reads env through `parseEnv` from `lib/env-schema.ts` (scripts cannot import `server-only` modules); create a script-safe DB client in `scripts/db.ts`.

## Verify (Claude Code)

- `npm run verify` passes, including new tests for tokens and `canTransition` (valid and invalid transitions).
- Run `npm run db:seed` twice; both succeed and counts are identical (3 jobs, 15 candidates).
- Query Supabase to confirm Rohan Nair has a null email and every row has `is_demo = true`.

## Finish

Update PROGRESS.md, commit `feat(data): types, status map, receipts, tokens, demo seed`.

## You check

In Supabase → Table Editor → candidates: 15 rows, five on the Full-Stack Developer job.
