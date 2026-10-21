"use client"

import * as React from "react"
import Link from "next/link"
import { ChevronDown } from "lucide-react"
import { motion, useReducedMotion } from "motion/react"
import { AIMark } from "@/components/ui/ai-mark"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { ErrorState } from "@/components/ui/error-state"
import { Input } from "@/components/ui/input"
import { Kbd } from "@/components/ui/kbd"
import { ProgressRail, type RailStep } from "@/components/ui/progress-rail"
import { Skeleton } from "@/components/ui/skeleton"
import { Textarea } from "@/components/ui/textarea"
import { plural } from "@/lib/format-text"
import type { Clarification, ResolvedPlan } from "@/lib/ai/resolve-plan"
import type { StepStatus } from "@/lib/status"

export const EXAMPLES = [
  "Prepare a 30-minute full-stack developer assessment for the five candidates in this job. Cover React, APIs, SQL and debugging. Show me the questions before inviting anyone.",
  "Prepare the next hiring steps, identify blockers and draft outstanding follow-ups. Ask me before sending anything.",
]

type PlanStep = { position: number; action: string; title: string; status: StepStatus }
type Result =
  | { status: "ready"; runId: string; plan: ResolvedPlan; steps: PlanStep[] }
  | { status: "needs_clarification"; plan: ResolvedPlan; clarifications: Clarification[] }
  | { status: "unsupported"; plan: ResolvedPlan }

type Phase =
  | { name: "idle" }
  | { name: "planning" }
  | { name: "done"; result: Result }
  | { name: "error"; message: string }

const STEP_DETAIL: Record<string, string> = {
  generate_questions: "Ready",
  track_submissions: "Starts once links go out",
  score_and_report: "Starts as answers arrive",
  analyze_pipeline: "Reads your jobs and candidates",
  draft_followups: "Nothing is sent",
}

export function CommandCentre({ jobs, defaultJobId }: { jobs: { id: string; title: string }[]; defaultJobId: string | null }) {
  const reduce = useReducedMotion()
  const [text, setText] = React.useState("")
  const [jobId, setJobId] = React.useState<string | null>(defaultJobId)
  const [phase, setPhase] = React.useState<Phase>({ name: "idle" })
  const [answer, setAnswer] = React.useState("")
  const inFlight = React.useRef(false)

  const jobTitle = jobs.find((j) => j.id === jobId)?.title ?? "No job selected"
  const compact = phase.name !== "idle"

  const plan = React.useCallback(
    async (instruction: string) => {
      if (inFlight.current || instruction.trim().length < 3) return
      inFlight.current = true
      setPhase({ name: "planning" })
      setAnswer("")
      try {
        const res = await fetch("/api/agent/plan", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ instruction: instruction.trim(), ...(jobId ? { jobId } : {}) }),
        })
        const body = (await res.json().catch(() => null)) as { data?: Result; error?: { message?: string } } | null
        if (res.ok && body?.data) setPhase({ name: "done", result: body.data })
        else setPhase({ name: "error", message: body?.error?.message ?? "Couldn't create a plan." })
      } catch {
        setPhase({ name: "error", message: "Couldn't reach the server. Check your connection and retry." })
      } finally {
        inFlight.current = false
      }
    },
    [jobId]
  )

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault()
      void plan(text)
    }
  }

  const spring = reduce ? { duration: 0 } : { type: "spring" as const, duration: 0.35, bounce: 0 }

  return (
    <div className="mx-auto w-full max-w-[720px] px-4 pb-24 md:px-6">
      <motion.div initial={false} animate={{ y: compact ? 0 : 72 }} transition={spring} className="pt-12">
        <motion.h1
          initial={false}
          animate={{ scale: compact ? 0.727 : 1 }}
          transition={spring}
          style={{ transformOrigin: "50% 0" }}
          className="t-hero text-center text-ink"
        >
          Tell Rekrutly what to do.
        </motion.h1>

        <div className="mt-8">
          <Textarea
            aria-label="Instruction for Rekrutly"
            placeholder="Describe what you want done"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={onKeyDown}
            className="min-h-[72px] rounded-[18px] px-5 py-[22px] text-[20px] leading-7"
          />
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="secondary" size="sm" aria-label={`Job: ${jobTitle}`}>
                  For: {jobTitle}
                  <ChevronDown aria-hidden className="ml-1 size-3.5" strokeWidth={1.75} />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuRadioGroup value={jobId ?? ""} onValueChange={setJobId}>
                  {jobs.map((j) => <DropdownMenuRadioItem key={j.id} value={j.id}>{j.title}</DropdownMenuRadioItem>)}
                </DropdownMenuRadioGroup>
              </DropdownMenuContent>
            </DropdownMenu>
            <span className="t-callout flex items-center gap-2 text-ink-2">
              <Kbd>Enter</Kbd> to plan
              <Button variant="secondary" size="sm" disabled={phase.name === "planning" || text.trim().length < 3} onClick={() => void plan(text)}>
                Make a plan
              </Button>
            </span>
          </div>
        </div>

        {phase.name === "idle" || phase.name === "error" ? (
          <div className="mt-6">
            <p className="t-callout mb-2 text-ink-2">Try</p>
            <ul className="flex flex-col items-start gap-2">
              {EXAMPLES.map((ex) => (
                <li key={ex}>
                  <button
                    type="button"
                    onClick={() => setText(ex)}
                    className="focus-ring t-callout rounded-md text-left text-action hover:text-action-hover"
                  >
                    {ex}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </motion.div>

      <div className="mt-10" aria-live="polite">
        {phase.name === "planning" ? <Planning /> : null}
        {phase.name === "error" ? (
          <ErrorState message={phase.message} hint="Retry, or change the instruction." onRetry={() => void plan(text)} />
        ) : null}
        {phase.name === "done" ? (
          <Outcome
            result={phase.result}
            answer={answer}
            setAnswer={setAnswer}
            onAnswer={(c) => void plan(`${text.trim()}\n${c.question} ${answer.trim()}`)}
            onExample={setText}
          />
        ) : null}
      </div>
    </div>
  )
}

function Planning() {
  return (
    <div role="status">
      <p className="t-callout mb-5 text-ink-2">Reading your instruction…</p>
      <div className="flex flex-col gap-6">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="flex items-center gap-3">
            <Skeleton className="size-5 rounded-full" />
            <div className="flex-1"><Skeleton className="h-[22px] w-1/2" /><Skeleton className="mt-1 h-[18px] w-1/3" /></div>
          </div>
        ))}
      </div>
    </div>
  )
}

function Outcome({
  result, answer, setAnswer, onAnswer, onExample,
}: {
  result: Result
  answer: string
  setAnswer: (v: string) => void
  onAnswer: (c: Clarification) => void
  onExample: (t: string) => void
}) {
  if (result.status === "unsupported") {
    return (
      <div className="py-6">
        <p className="t-headline text-ink">I can&apos;t do that yet.</p>
        <p className="t-body mt-1 text-ink-2">Today I can create and run assessments, and prepare follow-ups.</p>
        <ul className="mt-4 flex flex-col items-start gap-2">
          {EXAMPLES.map((ex) => (
            <li key={ex}>
              <button type="button" onClick={() => onExample(ex)} className="focus-ring t-callout rounded-md text-left text-action hover:text-action-hover">{ex}</button>
            </li>
          ))}
        </ul>
      </div>
    )
  }

  if (result.status === "needs_clarification") {
    const c = result.clarifications[0]
    if (!c) return null
    return (
      <form
        onSubmit={(e) => { e.preventDefault(); if (answer.trim()) onAnswer(c) }}
        className="flex flex-col gap-3 py-4"
      >
        <label htmlFor="clarify" className="t-headline text-ink">{c.question}</label>
        <div className="flex items-start gap-3">
          <Input id="clarify" value={answer} onChange={(e) => setAnswer(e.target.value)} placeholder="Your answer" autoFocus />
          <Button type="submit" disabled={!answer.trim()} className="h-11">Continue</Button>
        </div>
      </form>
    )
  }

  const { plan, steps, runId } = result
  const railSteps: RailStep[] = steps.map((s) => ({
    id: String(s.position), title: s.title, status: s.status, detail: s.status === "awaiting_approval" ? undefined : STEP_DETAIL[s.action],
  }))
  const noEmail = plan.candidates.filter((c) => !c.has_email).length
  const phrases = plan.guardrail_flags.map((f) => `“${f.phrase}”`)
  const reasons = [...new Set(plan.guardrail_flags.map((f) => f.reason))]

  return (
    <div>
      <div className="flex items-center justify-between">
        <h2 className="t-title text-ink">Plan</h2>
        <AIMark />
      </div>
      <p className="t-body mt-2 text-ink">{plan.summary}</p>

      {plan.guardrail_flags.length > 0 ? (
        <div role="note" className="mt-5 rounded-group bg-warning-tint p-4">
          <p className="t-body text-ink">I left out {phrases.join(", ")}.</p>
          <p className="t-callout mt-1 text-ink-2">{reasons.join(" ")}</p>
        </div>
      ) : null}

      <div className="mt-6"><ProgressRail steps={railSteps} /></div>

      <div className="t-callout mt-6 flex flex-col gap-1 text-ink-2">
        {plan.candidates.length > 0 ? (
          <p>
            {plural(plan.candidates.length, "candidate")}
            {noEmail > 0 ? `, ${noEmail} without email` : ""}
          </p>
        ) : null}
        {plan.assumptions.length > 0 ? <p>Assumptions: {plan.assumptions.join(" ")}</p> : null}
      </div>

      <div className="mt-8">
        <Button asChild>
          <Link href={plan.intent === "follow_up_sweep" ? `/runs/${runId}` : `/runs/${runId}?generate=1`}>{plan.intent === "follow_up_sweep" ? "Review the plan" : "Write the questions"}</Link>
        </Button>
      </div>
    </div>
  )
}
