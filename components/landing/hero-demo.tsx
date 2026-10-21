"use client"

import * as React from "react"
import { useInView } from "motion/react"
import { Check } from "lucide-react"
import { cn } from "cn"
import { useTicker } from "./use-ticker"

const SENTENCE = "Prepare a 30-minute full-stack developer assessment for the five candidates in this job. Show me the questions before inviting anyone."
const STEPS = [
  "Write 10 questions",
  "Create the assessment",
  "Create 5 candidate links",
  "Send invitations",
  "Track submissions",
  "Score and prepare reports",
]
const RECEIPTS = ["Wrote 10 questions across 4 skills", "Published the assessment", "Created 5 candidate links"]

// One loop is 18 seconds at 100 ms a tick: typing, the plan appears, a person approves, the receipts fill in.
const LOOP = 180
const TYPE_END = 42
const PLAN_AT = 50
const APPROVE_AT = 100
const DONE_FROM = 108
const RECEIPT_FROM = 112

/** The signature moment from the product, played on loop: one instruction becomes a plan, a person approves, receipts appear. */
export function HeroDemo() {
  const ref = React.useRef<HTMLDivElement>(null)
  const visible = useInView(ref, { margin: "-10%" })
  const tick = useTicker(LOOP, 150, visible)
  const typed = SENTENCE.slice(0, Math.floor(SENTENCE.length * Math.min(1, tick / TYPE_END)))
  const approved = tick >= APPROVE_AT
  const doneCount = approved ? Math.max(0, Math.min(3, Math.floor((tick - DONE_FROM) / 5) + 1)) : 0

  return (
    <div ref={ref} className="mx-auto w-full max-w-[880px] overflow-hidden rounded-[18px] border border-hairline/70 bg-canvas text-left shadow-[0_20px_60px_rgb(0_0_0/0.10)]">
      <div className="flex items-center gap-2 border-b border-hairline/60 bg-mist px-4 py-3">
        <span className="size-2.5 rounded-full bg-fog" /><span className="size-2.5 rounded-full bg-fog" /><span className="size-2.5 rounded-full bg-fog" />
        <span className="t-footnote ml-3 text-ink-2">Command Centre</span>
      </div>
      <div className="grid gap-0 md:grid-cols-[1.1fr_1fr]">
        <div className="min-h-[300px] p-5 sm:p-7">
          <p className="t-callout text-ink-2">Tell Rekrutly what to do.</p>
          <div className="mt-3 min-h-[116px] rounded-[14px] bg-mist px-4 py-3.5">
            <p className="t-body text-ink">
              {typed}
              {tick < TYPE_END ? <span aria-hidden className="ml-0.5 inline-block h-[1.05em] w-px translate-y-0.5 bg-ink" /> : null}
            </p>
          </div>
          <div className="mt-4 flex items-center gap-3">
            <span className={cn("t-callout inline-flex h-9 items-center rounded-full px-4 text-white transition-colors duration-300", approved ? "bg-success" : tick >= PLAN_AT + 40 ? "bg-action" : "bg-action/40")}>
              {approved ? "Approved" : "Approve and create links"}
            </span>
            <span className="t-callout text-ink-2">{approved ? "Running the steps" : tick >= PLAN_AT ? "Nothing has happened yet" : ""}</span>
          </div>
          <ul aria-label="Receipts" className="mt-5 flex min-h-[76px] flex-col gap-1.5">
            {RECEIPTS.slice(0, Math.max(0, Math.floor((tick - RECEIPT_FROM) / 8) + 1)).map((r) => (
              <li key={r} className="t-callout rail-in flex items-center gap-2 text-ink-2"><Check aria-hidden className="size-3.5 text-success" strokeWidth={2.5} />{r}</li>
            ))}
          </ul>
        </div>
        <div className="border-t border-hairline/60 bg-canvas p-5 sm:p-7 md:border-l md:border-t-0">
          <div className="flex items-center justify-between">
            <p className="t-headline text-ink">Plan</p>
            <span className="t-footnote inline-flex items-center gap-1 text-ai">Suggested by AI</span>
          </div>
          <ol className="mt-4 flex flex-col gap-3.5">
            {STEPS.map((s, i) => {
              const shown = tick >= PLAN_AT + i * 5
              const done = i < doneCount
              const needsYou = [1, 2, 3].includes(i) && !approved
              return (
                <li key={s} className={cn("flex items-start gap-3 transition-all duration-300", shown ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0")}>
                  <span aria-hidden className={cn("mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border transition-colors duration-300", done ? "border-success bg-success text-white" : needsYou ? "border-warning" : "border-hairline")}>
                    {done ? <Check className="size-3" strokeWidth={3} /> : null}
                  </span>
                  <span className="min-w-0">
                    <span className={cn("t-body block", done ? "text-ink" : "text-ink-2")}>{s}</span>
                    {needsYou ? <span className="t-footnote block text-warning">Waiting for you</span> : null}
                  </span>
                </li>
              )
            })}
          </ol>
        </div>
      </div>
    </div>
  )
}
