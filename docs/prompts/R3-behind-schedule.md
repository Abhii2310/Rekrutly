# R3 — Behind schedule

Use when a prompt has taken more than 1.5× its time box, or when fewer than 10 hours remain and prompts 11–12 aren't done.

## Instructions for Claude Code

1. Read `docs/PROGRESS.md` and `git log --oneline -20`. Tell me in five lines what works, what is half-built, and what the golden path needs that's missing.
2. Protect the golden path above everything: command → plan → questions → approve → links → portal → submit → score → evidence → receipts.
3. For anything half-built that is not on the golden path: hide its entry points (nav item, button, link) behind a server-side flag in `lib/features.ts` so nothing visible is broken. Do not delete the code.
4. Cut in this order if needed: Analytics → Compare → follow-up sweep intent → voice → Spotlight → multilingual drafts (keep English) → War Room tasks (keep live candidate rows and receipts).
5. Never cut: saved fallbacks, Demo Director reset, the evidence sheet, the guardrail notice.
6. Make sure the remaining UI has no dead buttons and passes `npm run verify` and the e2e test.
7. Update PROGRESS.md with what was hidden, commit `chore: scope cut to protect golden path`, and give me a revised schedule for the remaining hours.
