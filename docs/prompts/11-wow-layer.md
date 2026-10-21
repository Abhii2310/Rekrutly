# Prompt 11 — Wow layer

Time box: 3.5 hours. Read ARCHITECTURE sections 4 (Fallback), 5 and 13, DESIGN.md → Spotlight. Build the items in order; each must be complete and verified before the next. If time runs out, stop after a finished item and skip the rest (note it in PROGRESS.md).

## Goal

The details that make judges lean forward, plus the safety nets that make the live demo unbreakable.

## Build

1. **Saved fallbacks (do first; this protects the demo).**
   - `scripts/capture-fallback.ts` (`npm run capture:fallback -- --run <id>`): reads a successful demo run's planner output and its questions + keys from the database and writes `lib/ai/fallbacks/demo-plan.json` and `lib/ai/fallbacks/demo-questions.json` (validated with the same Zod schemas before writing). The capture must refuse runs whose job or candidates are not the fixed seeded IDs, so the fallback keeps working after every reset.
   - In DEMO_MODE only: when planning or question generation fails, the ErrorState offers a secondary button "Use saved demo plan" / "Use saved questions". Using it creates the same records the AI path would, marks them (`plan.fallback = true`), shows a neutral "Saved" pill wherever that content appears, and logs `plan.fallback_used` / `questions.fallback_used`. Never silent.
   - Tell the user to run the capture after a good run and commit the JSON.
2. **Spotlight (Cmd/Ctrl+K)** from anywhere in the recruiter app, per DESIGN.md: typing a sentence and pressing Enter sends it to the planner with the current job context and navigates to the Command Centre result; arrow keys also reach quick navigation (jobs, candidates by name, latest War Room). Uses the restyled shadcn Command.
3. **Voice input** in the Command Centre and Spotlight: a mic button shown only if `SpeechRecognition || webkitSpeechRecognition` exists. `lang = 'en-IN'`, interim results stream into the input, a quiet pulsing ring while listening, stops on silence or second tap, never auto-submits (the recruiter presses Enter). Errors (permission denied, no speech) show one calm line.
4. **Guardrail moment polish:** make the guardrail notice in the plan a deliberate, beautiful moment: the flagged phrase shown in quotes, the reason in one sentence, and a receipt in Activity ("Guardrail: removed an age filter"). Add the example "…but only invite candidates under 30" as a third quiet example link in the Command Centre.
5. **Demo Director** `/demo` (recruiter + DEMO_MODE only; 404 otherwise):
   - "Reset demo data": confirmation dialog that says in plain words: "This deletes every demo run, assessment, invitation and submission, including ones you created by hand. The seeded jobs and candidates are recreated with the same IDs, so saved fallbacks stay valid." Then `POST /api/demo/reset` runs the same logic as `scripts/seed.ts` (extract it into `lib/demo/seed.ts`, which takes a Supabase client as a parameter and imports nothing `server-only`, so both the script and the API route can use it). Shows the result counts. Reset deletes every demo run, assessment, invitation and submission, including ones created by hand in DEMO_MODE. Fixed seeded UUIDs keep saved fallbacks valid.
   - "Simulate submissions": choose the latest live assessment, pick which candidates (default: everyone except the one you'll take live), and press Start. `POST /api/demo/simulate` handles one candidate per call; the page calls it for each candidate 8–12 seconds apart so the War Room fills in gradually. Each simulated candidate gets a strength profile derived from their seeded skills (strong in listed skills, weaker elsewhere); MCQ choices are correct with probability by strength; short answers are written by the fast model in that candidate's plausible voice and strength (fallback to templated answers). Everything goes through the real start/answer/submit services, so scoring and reports are real. Submissions and events carry `is_simulated = true` and show `SimulatedTag` everywhere.
   - "Seed history": creates a closed assessment on the Backend Engineer (Go) job with 3 simulated submissions so Analytics has history. Also exposed as `npm run db:seed -- --with-history`.
   - A "Demo checklist" panel: health status (db, AI, email), number of live links, and buttons to open the Command Centre and the candidate link for Aarav.
6. **Integrity signals summary** on the War Room candidate rows (a quiet "2 tab switches" callout, never red).

## Constraints

- Simulation code lives only under `lib/demo/` and is unreachable when `DEMO_MODE` is false (check on the server).
- No new dependencies except what shadcn Command already brought.

## Verify (Claude Code)

- `npm run verify` passes; unit tests for strength-profile answer selection (deterministic with a seed).
- Live: force an AI failure, use the saved plan, and complete the golden path with "Saved" labels visible. Spotlight opens with Cmd+K and Ctrl+K. Voice works in Chrome (if the environment cannot test audio, verify feature detection hides the button in Firefox and explain how the user should test). Reset twice in a row. Simulate four candidates while watching the War Room; all four end with reports.
- Screenshots of Spotlight, the guardrail notice and Demo Director; DESIGN.md checklist.

## Finish

Update PROGRESS.md (simulation clearly listed under "Simulated or demo-only"), commit `feat(demo): fallbacks, spotlight, voice, guardrail moment, demo director`.

## You check

Run the whole 5-minute demo from `docs/PITCH.md` once with simulation on. Note anything slow.
