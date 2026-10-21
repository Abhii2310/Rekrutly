# Prompt 14 — Ship and demo readiness

Time box: 3 hours. Read `docs/PITCH.md`.

## Goal

The deployed URL is verified end to end, the repository explains itself, and there is a minute-by-minute demo runbook with a recovery move for every failure.

## Build

1. **Production check:** confirm with the user that every env var is set in Vercel (list them, never print values). Hit `<APP_URL>/api/health`. Run `PLAYWRIGHT_BASE_URL=<vercel-url> npm run e2e` against production with the fallback flag and then once with real AI. Report timings for planning, question generation and scoring on production.
2. **README.md** (for judges reading the repo): one-paragraph product summary; "How it works" with the AI proposes, people approve, code executes rule; architecture bullet list; data model summary; security and privacy measures (token hashing and encryption, server-owned deadlines, answer keys isolated, RLS on with no public policies, append-only receipts, guardrails, consent notice, signals-not-proof); "What's real vs simulated" copied from PROGRESS.md; local setup in 6 steps; tests; the AI provider that powered the demo and, if Google free tier, the note that only demo data is sent to the model; roadmap (calendar scheduling, ATS integrations, SSO, DPDP consent records and deletion workflow).
3. **docs/DEMO.md** runbook: pre-flight checklist (30 minutes before: reset, health, laptop charged, Chrome recruiter window logged in, phone ready with the portal, hotspot, backup video open in a tab, notifications off, browser zoom 110%); the 5-minute script from PITCH.md with the exact clicks; for each minute, the failure and the recovery (AI slow → "Use saved demo plan"; Wi-Fi down → hotspot, then backup video; candidate link issue → open Aarav's link from Demo Director; scoring slow → show objective score first and narrate the evidence sheet on a pre-scored simulated candidate).
4. **Favicon and metadata:** a simple monochrome favicon (the letter R in SF-like weight on white, SVG), Open Graph title and description, `robots: noindex` for the portal.
5. **Final reset** and tag the release: `git tag v1.0-demo`.

## Verify (Claude Code)

- E2E passes against production.
- README renders cleanly on GitHub (check headings and code blocks).

## Finish

Update PROGRESS.md, commit `docs: readme, demo runbook, release`. Tell the user to: record a 5-minute backup video of the full demo on the production URL, then rehearse three times with a timer.
