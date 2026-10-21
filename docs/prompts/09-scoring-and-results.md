# Prompt 09 — Scoring, reports and results

Time box: 3.5 hours. Read ARCHITECTURE sections 4 and 6, DESIGN.md → Results and report.

## Goal

When a candidate submits, the recruiter sees within seconds a real objective score, then AI-suggested scores for written answers with the exact evidence and rubric points behind them, a skill breakdown, and interview questions aimed at the gaps. Every AI judgement is labelled, explainable and overridable.

## Build

1. **Short-answer grading** `lib/scoring/short-answer.ts`: for each short question, empty answer → score 0, `unanswered`, no model call. Otherwise call the fast model with the question, rubric, model answer and the candidate's answer (no name, no other candidate data). System prompt: grade only against the rubric; quote the shortest exact span of the answer that best supports the score; do not reward length; do not penalise grammar or English fluency unless the rubric asks for it. Post-validate per ARCHITECTURE (clamp, exact-substring evidence or null + low confidence). Store `question_scores` with method `ai_suggested`.
2. **Aggregate** `lib/scoring/aggregate.ts` (pure, unit-tested): objective totals, AI-suggested totals, final totals using `overridden_score` when present, per-skill breakdown with percentages rounded to whole numbers.
3. **Report** `lib/ai/report.ts`: smart model, input = job title and skills, per-question results (prompt summary, skill, score/max, method, evidence), and nothing personal. Output `CandidateReport`. Post-validation: skills must exist in the job or assessment; evidence strings must come from the provided evidence.
4. **Pipeline**: do not rewrite `/submit`. Put grading → aggregate → report in `runPostSubmitPipeline(submissionId)` in `lib/scoring/pipeline.ts`, called from `after()` in `POST /api/c/[token]/submit` (after its existing synchronous objective scoring) and from the rescore route. All Prompt 08 tests must pass unchanged. Add a test proving the objective score is still saved when the pipeline throws. The pipeline moves statuses, moving `scoring_status` (`scoring → scored | failed`) and `report_status` (`generating → ready | failed`). Receipts: `score.ai_suggested`, `report.ready`, or `score.failed` / `report.failed` with the error. Run the `score_and_report` step bookkeeping (it shows "Scored 1 of 5") and complete the run when every invitation is submitted or expired and every report is ready or failed.
5. **Recruiter routes:** `POST /api/submissions/[id]/rescore` (re-run whatever failed; idempotent), `PATCH /api/question-scores/[id]` (override with `{ score, reason }`, reason ≥3 chars, logs `score.overridden` with old and new values, recomputes aggregates). Opening a submission for the first time moves the candidate to `under_review` and logs `candidate.review_started`.
6. **Results page** `/assessments/[id]/results`: header with assessment title and counts; GroupedList of all invited candidates with live state from polling (Not started, Question 4 of 10, Submitted, Scoring…, Ready), objective %, AI-suggested % with AIMark, and final %. Checkboxes (max 4) feed a "Compare" button (page arrives in Prompt 12; hide the button until then). Link from the run page.
7. **Submission page** `/submissions/[id]` per DESIGN.md: header (name, job, submitted time, `auto_submitted` note if any); three Stats (Objective score, Suggested AI score with AIMark, Questions answered); skill bars; question-by-question list (MCQ: chosen vs correct option; short: the answer excerpt and score). Tapping a short answer opens the evidence Sheet: full answer with the evidence quote highlighted in `ai-tint`, matched points with checks, missing points, reasoning, confidence, "Override score" form (number + reason). Report sections: summary, strengths with evidence, gaps with evidence, "Suggested interview questions" (skill, question, what good looks like), "Missing evidence". Integrity signals in a quiet row: "Signals (not proof): switched tabs 2 times, pasted once" with a tooltip explaining why they're not proof. "Save as PDF" button calls `window.print()`; add a print stylesheet that hides navigation and buttons and keeps the AI labels.
8. **Candidate profile Sheet**: the Assessments section now lists submissions with final % and a link.
9. Scoring states: while scoring, show the objective result immediately and skeletons for AI parts with "Reviewing written answers…". On failure: ErrorState with "Retry scoring".

## Constraints

- Never label anyone "best", "top" or "recommended". The report describes evidence; the recruiter decides.
- Model text is rendered as plain text.

## Verify (Claude Code)

- `npm run verify` passes with tests for aggregate (with and without overrides), clamp, evidence check, report post-validation.
- Live Day 2 test with a browser check (see CLAUDE.md → Browser checks): candidate submits with one strong and one empty short answer → within 30 seconds the submission page shows objective score, AI-suggested scores with highlighted evidence, the empty one as 0 "Unanswered", skill bars and interview questions. Override one score with a reason; totals update; Activity shows the override.
- Simulate an AI failure (invalid API key in a test env var override, or a forced error flag) and confirm the Retry path works.
- Screenshot results and submission pages and the evidence sheet; DESIGN.md checklist; print preview looks clean.

## Finish

Update PROGRESS.md, commit `feat(results): AI-suggested grading with evidence, reports, overrides`.

## You check

Open the evidence sheet and ask yourself: "Would a sceptical judge trust this score?" The highlighted quote and rubric points must make the score obvious.
