# Prompt 05 — Command Centre (the agent plans)

Time box: 3 hours. Read `docs/ARCHITECTURE.md` sections 3, 4 and 5 carefully, and DESIGN.md → Screens → Command Centre. Before writing AI code, read the structured output docs in `node_modules/ai/docs/` for the installed version.

## Goal

The recruiter types the demo sentence and, within seconds, sees a validated, honest plan built from real data: which job, which candidates, what will happen, what needs approval, what was assumed, and anything the guardrail removed.

## Build

1. **AI client** `lib/ai/client.ts`: `getModel('smart' | 'fast')` using `@ai-sdk/anthropic` and env model IDs; `runStructured({ tier, system, prompt, schema, temperature, timeoutMs = 45000 })` that calls `generateText` with `output: Output.object({ schema })`, aborts on timeout, retries once on the fast model, and returns `Result<T>` with `AiError` codes `timeout | invalid_output | provider_error`. Log duration and token usage to the server console (never the prompt contents in production).
2. **Schemas** `lib/ai/schemas.ts`: write every schema from ARCHITECTURE section 4 now (planner, questions, grade, report, follow-up) so later prompts reuse them. Add fixture tests with one valid and two invalid examples each.
3. **Guardrail** `lib/guardrails/protected.ts`: `checkInstruction(text)` → `{ flagged: { phrase, reason }[] }` per ARCHITECTURE section 5. Unit tests must include every case listed there, plus Hindi words for caste and religion if you add them.
4. **Planner** `lib/ai/planner.ts`:
   - Context sent to the model: open jobs (id, title, skills) and, for the selected job (or all open jobs if none, max 50 candidates), candidates (id, name, stage, has_email boolean, skills). Nothing else about candidates.
   - System prompt: you are Rekrutly's planner; extract parameters only; never invent IDs; prefer clarifying over guessing for job or candidates; flag any instruction that uses protected characteristics; supported intents only; output must match the schema.
   - `resolvePlan(raw, context)` (pure, unit-tested): drops unknown IDs, applies the "these five" rule and defaults (10 questions, 30 minutes, MCQ + short, mixed difficulty), merges code guardrail flags with model flags, and returns `{ plan, clarifications, assumptions }`.
5. **Plan builder** `lib/executor/plan-builder.ts` (pure, unit-tested): template per intent from ARCHITECTURE section 3 → ordered step definitions with plain-English titles using real numbers ("Write 10 questions", "Create 5 candidate links", "Send invitations to 4 candidates with email").
6. **Route** `POST /api/agent/plan` (`maxDuration = 60`): body `{ instruction, jobId? }`; recruiter required; guardrail → planner → resolve → if a blocking clarification exists (no job, or zero candidates), return it without creating a run; otherwise insert `workflow_runs` (status `draft`, `is_demo = isDemoMode`, plan jsonb) and its `workflow_steps` (approval-requiring steps start as `awaiting_approval`, others `planned`), then log `plan.created` (actor agent) and `guardrail.triggered` when relevant. Return the run with steps.
7. **Command Centre UI** (`/command`), per DESIGN.md:
   - Hero line "Tell Rekrutly what to do." and the large input (Enter submits, Shift+Enter new line). A small job chip under it ("For: Full-Stack Developer"), defaulting to `?job=` or the most recently created open job, changeable via a dropdown.
   - Two example prompts as plain links that fill the input: the demo sentence, and "Prepare the next hiring steps, identify blockers and draft outstanding follow-ups. Ask me before sending anything."
   - While planning: the hero animates up (one spring), and a ProgressRail skeleton appears with the callout "Reading your instruction…".
   - Result: AIMark, the plan `summary`, the ProgressRail in planned/awaiting states, "Assumptions" as a short sentence list, recipients summary ("5 candidates, 1 without email"), guardrail notice when present (calm `warning-tint` panel: "I left out 'under 30'. Rekrutly doesn't filter candidates by age or other personal characteristics."), and the primary button "Write the questions" which calls Prompt 06's endpoint (until then, link to `/runs/[id]`).
   - Clarification: show the question with an inline input; answering re-plans with the original instruction plus the answer.
   - Unsupported: "I can't do that yet. Today I can create and run assessments, and prepare follow-ups." with the two example links.
   - Errors: ErrorState "Couldn't create a plan because the AI took too long." with Retry.
8. `/runs/[id]` page: for now shows the run summary and its ProgressRail; Prompts 06–07 extend it.

## Constraints

- The model never decides steps, statuses or IDs on its own; code does.
- No candidate PII beyond name, skills, stage and has_email goes to the model.

## Verify (Claude Code)

- `npm run verify` passes with tests for guardrail, resolvePlan, plan-builder and schemas.
- Live check (real API call): the demo sentence on the Full-Stack job returns intent `create_assessment_workflow`, 5 candidates, 30 minutes, skills React/APIs/SQL/Debugging, `preview_before_invite = true`, 6 steps, and "1 without email".
- "Create an assessment but only invite candidates under 30" produces a guardrail notice and still a valid plan.
- "Book a flight to Goa" returns unsupported.
- Screenshot the result state and run the DESIGN.md checklist.

## Finish

Update PROGRESS.md, commit `feat(agent): guardrails, planner, plan builder, command centre`.

## You check

Type the demo sentence yourself three times. It must work every time in under ~10 seconds.
