# Prompt 06 — Question builder

Time box: 2 hours. Read ARCHITECTURE sections 3–4 and 6, DESIGN.md → Screens → Review and approve (left column only in this prompt).

## Goal

Rekrutly writes a high-quality, job-specific assessment the recruiter can read, edit, regenerate one question at a time, delete and add to. Answer keys are stored separately and never sent to the candidate side.

## Build

1. **Generator** `lib/ai/questions.ts`:
   - `generateQuestionSet({ job, skills, count, durationMinutes, types, difficulty })` with the smart model, temperature 0.6.
   - System prompt essentials: write practical questions a working developer would recognise (real code snippets in prompts are welcome, kept short); spread questions across the requested skills; MCQ must have exactly one defensibly correct option and plausible distractors; short-answer questions must be answerable in 3–6 sentences within the time limit and come with a rubric of 2–5 checkable points; no trivia, no trick questions, nothing about personal characteristics.
   - Default mix when not specified: 70% MCQ, 30% short answer (10 → 7 + 3). Points: MCQ 1–2 by difficulty, short 4–6.
   - Post-validation (pure, unit-tested): exact count (trim extras, request the shortfall once), skills limited to the requested list, shuffle MCQ options in code and remap `correct_option` so correct answers spread across positions, total time sanity (warn in the result if questions likely exceed the duration).
2. **Persistence** `lib/db/mutations/assessments.ts`: create a `draft` assessment for the run (`run_id`, `job_id`, title, instructions, duration, skills, `is_demo`), insert questions with positions, and insert `question_keys` rows (correct option + explanation, or rubric). Do it in a safe order and clean up the assessment if a later insert fails.
3. **Routes** (all recruiter-only, `maxDuration = 60` where AI is called):
   - `POST /api/runs/[id]/questions`: runs the `generate_questions` step through the executor so its status moves `executing → completed` with receipts (`step.started`, `step.completed`: "Wrote 10 questions across 4 skills"). If an assessment already exists for the run, regenerate all (replace questions and keys) only when `{ replace: true }`.
   - `POST /api/questions/[id]/regenerate`: same type, skill and difficulty; replaces prompt/options/key; logs `question.regenerated`.
   - `PATCH /api/questions/[id]`: edit prompt, options, correct option, rubric, skill, difficulty, max score; sets `edited_by_recruiter = true`; logs `question.edited`.
   - `DELETE /api/questions/[id]`: deletes and renumbers positions; refuses to go below 3 questions.
   - `POST /api/assessments/[id]/questions`: add a manual question (`ai_generated = false`).
   - Every route refuses changes once the assessment is not `draft` (409 with a clear message).
4. **Review page, left column** (`/runs/[id]` when the run is `draft` or `awaiting_approval`):
   - Header: assessment title (editable inline), "10 questions, 30 minutes, 4 skills".
   - Questions as a GroupedList: number, first line of the prompt, type and skill as quiet text, difficulty pill, AIMark when AI-written and not edited (show "Edited" in callout when edited). Tap expands: full prompt (preserve code blocks in a mono font on `mist`), options with the correct one marked by a small check and "Correct answer" callout, or the rubric points and model answer. Actions: Edit (inline form, Save/Cancel), Regenerate (spinner on that row only), Delete (confirm in a small popover).
   - "Add question" plain button at the end.
   - While generating: the ProgressRail step shows executing and the list shows 10 skeleton rows with the callout "Writing 10 questions. This takes about 20 seconds."
   - Connect Command Centre's "Write the questions" button to this route then navigate here.

## Constraints

- Candidate-facing code does not exist yet, but write the question query for the recruiter as `getAssessmentForReview` and keep a separate, future `getQuestionsForCandidate` signature that selects no key fields. Never join `question_keys` in the latter.
- Model text renders as plain text (and code blocks), never as HTML.

## Verify (Claude Code)

- `npm run verify` passes with tests for post-validation (count trimming, option shuffle remap keeps the right answer, skill filtering).
- Live: generate for the demo run; 10 questions, 7 MCQ + 3 short, covering React, APIs, SQL, Debugging; edit one question, regenerate another, delete one, add one; reload and confirm everything persisted; `question_keys` row count equals question count.
- Screenshot the list collapsed and with one question expanded; run the DESIGN.md checklist.

## Finish

Update PROGRESS.md, commit `feat(assessment): AI question generation and editable builder`.

## You check

Read three generated questions as if you were a senior engineer. Are they good? If not, tighten the system prompt now; question quality is what judges will read.
