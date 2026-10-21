# Prompt 04 — Overview, jobs and candidates

Time box: 2.5 hours. Read `docs/DESIGN.md` (Layout, Components, Writing) and the queries in `lib/db/queries/`.

## Goal

The recruiter workspace looks populated and real from the first second, every number comes from the database, and candidates have a profile that later prompts will enrich.

## Build

1. **Overview** (`app/(recruiter)/page.tsx`):
   - PageHeader "Overview", description built from data (e.g. "3 open roles, 15 candidates"), primary action "New task" → `/command`.
   - Four `Stat`s in one row: Candidates, In assessment, Completion rate (show "No assessments yet" instead of 0% when there are no invitations), Need you (open tasks).
   - "Needs your attention": open tasks as a GroupedList (empty state: "Nothing needs you right now.").
   - "Active workflows": runs not completed/cancelled, each row: summary sentence, StatusPill, relative time, links to `/runs/[id]` (empty state: "No workflows yet. Ask Rekrutly to start one." with a button to `/command`).
   - "Recent activity": last 8 events, each row: message, actor in callout, relative time. Simulated events show `SimulatedTag`.
2. **Jobs** (`/jobs`): GroupedList, each row: title (headline), "Team, location" (callout), candidate count, and a short stage summary in text ("5 applied" / "2 in interview"). Demo rows show `DemoTag` once in the page header, not on every row.
3. **Job detail** (`/jobs/[id]`): header with title, team, location; primary action "Create assessment" → `/command?job=<id>`; skills as neutral pills; description in body text at 640px max width; candidates GroupedList with StatusPill per candidate; "Workflows for this job" list.
4. **Candidates** (`/candidates`): filters as a SegmentedControl for stage groups (All, New, In assessment, Review, Interview and later) plus a job dropdown and a search input (debounced, URL search params so it survives refresh). Rows: Avatar initials, name, current title at company, job, StatusPill.
5. **Candidate profile Sheet** (opens with `?c=<id>` so it is linkable and survives refresh): name (Title), current role, location, years of experience, skills pills, resume summary, contact (email or a calm "No email. Candidates can still use a link." with an inline "Add email" field), stage selector (dropdown of allowed transitions only), "Assessments" section (empty state for now), "Activity" (this candidate's events).
6. `PATCH /api/candidates/[id]`: Zod body `{ email?: string | null, stage?: Stage }`; validates transitions with `assertTransition`; logs `candidate.stage_changed` or `candidate.updated` with actor `recruiter`.
7. `loading.tsx` for each route with skeletons matching the real layout. Relative times via a small `lib/format.ts` (`formatRelative`, `formatDateTime` in en-IN, `formatPercent`).

## Constraints

- Server Components for pages; only the filters, sheet and inline forms are client components.
- No hard-coded counts. If a query fails, show `ErrorState` with Retry, not a blank page.

## Verify (Claude Code)

- `npm run verify` passes. Add tests for `lib/format.ts`.
- a browser check (see CLAUDE.md → Browser checks): Overview shows 15 candidates; Jobs shows 3 roles; open Rohan Nair's profile, add an email, change stage to an allowed value, confirm the activity list shows the change; refresh keeps the sheet open via `?c=`.
- Run the DESIGN.md checklist on Overview, Jobs, Job detail, Candidates and the Sheet. Fix failures.
- Reset Rohan's email to null afterwards (`npm run db:seed`).

## Finish

Update PROGRESS.md, commit `feat(workspace): overview, jobs, candidates, profile sheet`.

## You check

Does Overview look like something you would show a judge with no explanation? If any section feels empty or noisy, run R2 on it.
