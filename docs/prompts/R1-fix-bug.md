# R1 — Fix a bug

Copy this file's text into Claude Code and fill in the three blanks.

**What I did:** ______ (exact clicks or command)
**What I expected:** ______
**What happened instead:** ______ (paste the error, screenshot path, or terminal output)

## Instructions for Claude Code

1. Reproduce the bug first (a browser check for UI, see CLAUDE.md → Browser checks; a failing unit test for logic). Do not change code before you can reproduce it.
2. Find the root cause. Explain it in two sentences before fixing.
3. Make the smallest fix that addresses the root cause. Do not refactor unrelated code.
4. Add a test that would have caught it.
5. Run `npm run verify` and re-check the golden path up to the furthest built step.
6. Note the fix in `docs/PROGRESS.md` and commit `fix(<area>): <what>`.
7. If the fix needs a schema change, write a new migration file and tell me to run it; never edit `0001_init.sql`.
