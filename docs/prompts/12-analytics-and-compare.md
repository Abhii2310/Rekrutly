# Prompt 12 — Analytics and comparison

Time box: 2.5 hours. Read DESIGN.md (Stat, skill bars, Never list). Feature freeze starts when this prompt ends.

## Goal

Honest numbers from the database, drawn with Apple restraint, and a side-by-side comparison that shows evidence instead of picking a winner.

## Build

1. **Queries** `lib/db/queries/analytics.ts` (aggregate in SQL or in one pass in TypeScript; no N+1): per job stage counts; invitations created, started, submitted; completion rate; average objective % and final %; per-skill average % across submissions; median minutes from invitation to start and from start to submit; open tasks by type; share of demo or simulated data in the totals.
2. **Charts** without a chart library: `components/analytics/BarList` (horizontal bars, label left, value right in tabular nums, 8px bars `ink` on `fog`), `components/analytics/Funnel` (stages as a BarList ordered by pipeline), and a tiny `Sparkline`-free design (no line charts). Each chart has a one-sentence takeaway above it written by code from the numbers, e.g. "4 of 5 invited candidates finished. Average objective score 68%."
3. **Analytics page** `/analytics`: PageHeader with a job filter; a row of four Stats (Invited, Completion, Average objective score, Median time to finish); "Pipeline" funnel; "Skills" BarList; "Speed" two short sentences with medians; "Open work" task counts. If any included data is demo or simulated, a quiet line under the header: "Includes demo and simulated data." Empty state when nothing exists yet.
4. **Compare** `/compare?s=<submissionId>,<submissionId>[,…]` (2–4, same assessment; otherwise a clear error): columns per candidate with name, final %, objective %, suggested AI % (AIMark), time taken, answered count; rows per skill with score/max and the strongest evidence quote for that skill (truncated, expandable); a final row "Gaps to probe in interview" from each report. Footer sentence in callout: "Rekrutly doesn't pick a winner. Use the evidence and your judgement." Unhide the Compare button on the results page.
5. Add the Analytics link target and make sure the sidebar highlights correctly.

## Constraints

- No colours beyond tokens; no rainbow series; no "best" labels, crowns, rankings or sorting by "fit".
- Every number must be traceable to a query; no estimates or projected time savings.

## Verify (Claude Code)

- `npm run verify` passes with tests for the takeaway sentence builders and median calculation (even/odd counts, empty).
- Live with seeded history + one real submission: numbers match a manual SQL check you run and show in your report.
- Screenshot Analytics and Compare at 1280px; DESIGN.md checklist.

## Finish

Update PROGRESS.md, commit `feat(analytics): honest metrics and evidence-based comparison`. Announce: **feature freeze**. From now on only Prompts 13, 14 and the rescue prompts.
