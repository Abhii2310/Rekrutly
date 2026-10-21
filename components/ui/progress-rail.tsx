"use client"

import * as React from "react"
import { cn } from "cn"
import { Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import { statusLabel, type StepStatus } from "@/lib/status"

export type RailStep = {
  id: string
  title: string
  status: StepStatus
  /** One line under the title. Defaults to the status label for states that need words. */
  detail?: string
  timestamp?: string
  onRetry?: () => void
}

const DEFAULT_DETAIL: Partial<Record<StepStatus, string>> = {
  awaiting_approval: "Waiting for you",
}

function Marker({ status }: { status: StepStatus }) {
  const base = "relative flex size-5 shrink-0 items-center justify-center rounded-full"
  switch (status) {
    case "completed":
      return <span className={cn(base, "bg-success text-white")}><Check aria-hidden className="size-3" strokeWidth={3} /></span>
    case "failed":
      return <span className={cn(base, "bg-danger text-[12px] font-semibold leading-none text-white")}>!</span>
    case "awaiting_approval":
      return <span className={cn(base, "border-2 border-warning bg-canvas")} />
    case "waiting":
      return <span className={cn(base, "border border-action bg-canvas")} />
    case "executing":
      return (
        <span className={cn(base, "bg-canvas")}>
          <svg viewBox="0 0 20 20" className="absolute inset-0 size-5">
            <circle cx="10" cy="10" r="9" fill="none" stroke="var(--color-action)" strokeOpacity="0.25" strokeWidth="2" />
            <g className="rail-spin">
              <path d="M10 1a9 9 0 0 1 9 9" fill="none" stroke="var(--color-action)" strokeWidth="2" strokeLinecap="round" />
            </g>
          </svg>
        </span>
      )
    default:
      return <span className={cn(base, "border border-hairline bg-canvas")} />
  }
}

/** The signature element: steps light up as real events arrive. */
export function ProgressRail({ steps, className }: { steps: RailStep[]; className?: string }) {
  // Steps present on first render appear instantly; steps added later slide in.
  const [initialIds] = React.useState(() => new Set(steps.map((s) => s.id)))

  return (
    <ol className={cn("m-0 list-none p-0", className)}>
      {steps.map((step, i) => {
        const last = i === steps.length - 1
        const detail = step.detail ?? DEFAULT_DETAIL[step.status]
        return (
          <li key={step.id} className={cn("relative flex gap-3 pb-7", last && "pb-0", !initialIds.has(step.id) && "rail-in")}>
            {!last ? (
              <span aria-hidden className="absolute left-[9px] top-[26px] -bottom-0.5 w-0.5 overflow-hidden rounded-full bg-hairline/60">
                <span
                  className="block h-full w-full origin-top bg-success transition-transform duration-300 ease-[var(--ease-spring)]"
                  style={{ transform: `scaleY(${step.status === "completed" ? 1 : 0})` }}
                />
              </span>
            ) : null}
            <span className="mt-0.5"><Marker status={step.status} /></span>
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-3">
                <span className={cn("t-headline", step.status === "planned" || step.status === "skipped" ? "text-ink-2" : "text-ink")}>
                  {step.title}
                </span>
                {step.timestamp ? <span className="t-footnote tabular shrink-0 text-ink-2">{step.timestamp}</span> : null}
              </div>
              <p className={cn("t-callout", step.status === "failed" ? "text-danger" : "text-ink-2")}>
                <span className="sr-only">{statusLabel("step", step.status)}. </span>
                {detail}
              </p>
              {step.status === "failed" && step.onRetry ? (
                <Button variant="plain" size="sm" className="mt-1 px-0" onClick={step.onRetry}>Retry</Button>
              ) : null}
            </div>
          </li>
        )
      })}
    </ol>
  )
}
