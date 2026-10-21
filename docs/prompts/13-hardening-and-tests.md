# Prompt 13 — Hardening and tests

Time box: 4 hours. Feature freeze is in effect: fix, test and polish only. Read ARCHITECTURE section 15.

## Goal

Prove the product works, is safe, and looks finished on every screen, with an automated golden-path test you can run before going on stage.

## Build and audit

1. **E2E golden path** `tests/e2e/golden-path.spec.ts` (Playwright, two browser contexts). Set `E2E_USE_FALLBACK=true` support so the test can use the saved plan and questions for determinism (the real-AI path stays the default in the app). Steps: reset demo data via the API → log in → Command Centre → demo sentence → plan visible with 5 candidates → write questions → edit question 1 → approve → copy Aarav's link → candidate context at 375px: consent, answer all, submit → recruiter: results row shows Submitted and a score within 60s → open the submission → evidence sheet opens. Also a second spec for negative cases: invalid token, double submit, signed-out access to recruiter pages and APIs.
2. **Security audit** (write findings into PROGRESS.md and fix all):
   - `grep` proof that `question_keys` is never referenced under `app/api/c/` or `lib/portal/` and that no `select('*')` exists in candidate paths.
   - `server-only` present in every file importing the service-role client or `lib/env.ts`.
   - Tokens never appear in logs, events or error messages; session cookie flags correct; `proxy.ts` matcher reviewed.
   - Every route handler validates input with Zod and returns the standard error shape; unknown errors return 500 with a generic message and log details server-side.
   - Recruiter-only routes call `require-recruiter`; demo routes also check DEMO_MODE on the server.
   - Model output is never rendered as HTML.
   - `grep` proof that no file outside `lib/ai/client.ts` imports `@ai-sdk/*` providers or calls `gateway()` (the one allowed exception is `scripts/check-ai.ts`, which runs standalone before `lib/ai/client.ts` exists).
3. **Resilience:** every page has loading, empty and error states; every AI action has Retry; network errors in polling show "Reconnecting" without wiping the screen; double-clicks on primary buttons cannot double-submit (disable while pending).
4. **Accessibility:** labels on every input, focus order, visible focus, `aria-live="polite"` for autosave status and new Activity items, colour contrast ≥4.5:1 for body text, `prefers-reduced-motion` respected, portal fully keyboard-operable.
5. **Performance:** no client components that could be server components; no request waterfalls on Overview, Results and War Room (use `Promise.all`); `/live` responds in under 300ms locally with seeded data (measure and report).
6. **Design audit:** using a browser check (see CLAUDE.md → Browser checks), screenshot every screen (recruiter at 1280px; portal at 375px and 1280px; login; empty states via a fresh reset) and run the DESIGN.md checklist on each. Produce a table in your report: screen, issues found, fixed. Fix all of them.
7. Remove dead code, unused dependencies (`npx depcheck`), console noise, and TODOs that are not in PROGRESS.md.

## Verify (Claude Code)

- `npm run verify` and `npm run e2e` both pass twice in a row.
- Report the security audit, performance numbers and design audit table.

## Finish

Update PROGRESS.md (final honest lists), commit `chore: hardening, e2e golden path, audits`.
