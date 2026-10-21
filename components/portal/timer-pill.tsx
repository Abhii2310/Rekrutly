"use client"

import { cn } from "cn"

export function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  const mm = String(m).padStart(2, "0")
  const ss = String(sec).padStart(2, "0")
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`
}

/** Neutral until 5 minutes remain, warning under 5, danger under 1. Never flashes. */
export function TimerPill({ secondsLeft }: { secondsLeft: number }) {
  const tone = secondsLeft < 60 ? "bg-danger-tint text-danger" : secondsLeft < 300 ? "bg-warning-tint text-warning" : "bg-neutral-tint text-ink-2"
  return (
    <span role="timer" aria-label="Time left" className={cn("t-footnote tabular inline-flex h-7 items-center rounded-full px-3", tone)}>
      {formatClock(secondsLeft)}
    </span>
  )
}
