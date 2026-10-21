"use client"

import * as React from "react"
import { useInView } from "motion/react"
import { cn } from "cn"
import { useTicker } from "./use-ticker"

const PEOPLE = [
  { name: "Aarav Mehta", start: 3, every: 11 },
  { name: "Diya Raghunathan", start: 6, every: 8 },
  { name: "Kabir Shetty", start: 0, every: 0 },
  { name: "Ishita Banerjee", start: 9, every: 14 },
]

const clock = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")} left`

/** Candidate rows moving through a test, the way the War Room shows it. A sample, not live data. */
export function WarRoomDemo() {
  const ref = React.useRef<HTMLDivElement>(null)
  const visible = useInView(ref, { margin: "-10%" })
  const tick = useTicker(1200, 70, visible, 100)
  const seconds = Math.floor(tick / 10)
  return (
    <div ref={ref} className="rounded-[18px] border border-hairline/70 bg-canvas p-5 text-left sm:p-7">
      <div className="flex items-center justify-between">
        <p className="t-headline text-ink">Candidates</p>
        <span className="t-callout tabular text-ink-2">Sample</span>
      </div>
      <ul className="mt-4 overflow-hidden rounded-[10px] bg-mist/60">
        {PEOPLE.map((p, i) => {
          const q = p.every === 0 ? 0 : Math.min(10, p.start + Math.floor(seconds / p.every))
          const submitted = q >= 10
          const state = p.every === 0 ? "Not started" : submitted ? "Submitted" : `Question ${q} of 10`
          const left = Math.max(0, 1800 - (seconds + i * 40) % 1800)
          return (
            <li key={p.name} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)_5.5rem] items-center gap-3 border-b border-hairline/60 px-4 py-3 last:border-b-0">
              <span className="flex min-w-0 items-center gap-2.5">
                <span key={q} aria-hidden className={cn("size-2 shrink-0 rounded-full", p.every === 0 ? "bg-fog" : submitted ? "bg-success" : "bg-action", p.every !== 0 && "dot-pulse")} />
                <span className="t-body truncate text-ink">{p.name}</span>
              </span>
              <span className="t-callout tabular text-ink-2">{state}</span>
              <span className="t-callout tabular text-right text-ink-2">{p.every === 0 ? "–" : submitted ? "Done" : clock(left)}</span>
            </li>
          )
        })}
      </ul>
      <p className="t-callout mt-4 text-ink-2">Kabir has not started. Rekrutly drafts a nudge and waits for you to send it.</p>
    </div>
  )
}
