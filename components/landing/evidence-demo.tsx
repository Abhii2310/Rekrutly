"use client"

import * as React from "react"
import { motion, useInView, useReducedMotion } from "motion/react"
import { Check, Minus, Sparkles } from "lucide-react"

const RUBRIC = [
  { ok: true, text: "An index speeds up lookups by avoiding a full table scan" },
  { ok: true, text: "Mentions the cost: slower writes or extra storage" },
  { ok: true, text: "Says low-selectivity columns or tiny tables gain little" },
]

/** A written answer with the grader's exact quote highlighted and the rubric ticking off. A sample, not live data. */
export function EvidenceDemo() {
  const ref = React.useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { once: true, margin: "-80px" })
  const reduce = useReducedMotion()
  const on = inView || Boolean(reduce)
  const ease = [0.32, 0.72, 0, 1] as const
  return (
    <div ref={ref} className="rounded-[18px] border border-hairline/70 bg-canvas p-5 text-left sm:p-7">
      <div className="flex items-center justify-between gap-3">
        <p className="t-headline text-ink">Question 8, SQL</p>
        <span className="t-footnote text-ink-2">Sample</span>
      </div>
      <p className="t-callout mt-1 text-ink-2">Explain what a database index is and one case where adding one would not help.</p>
      <p className="t-body mt-4 rounded-[14px] bg-mist px-4 py-3.5 text-ink">
        An index is a data structure that lets the database{" "}
        <span className="relative inline">
          <motion.span
            aria-hidden
            className="absolute inset-x-0 inset-y-0 -mx-0.5 origin-left rounded-[4px] bg-ai-tint"
            initial={reduce ? false : { scaleX: 0 }}
            animate={{ scaleX: on ? 1 : 0 }}
            transition={{ duration: 0.9, delay: 0.3, ease }}
          />
          <span className="relative">find rows without scanning the whole table</span>
        </span>
        , so lookups on the indexed column are much faster. It does not help on small tables or on columns with only a few distinct values, and every index makes writes slower.
      </p>
      <ul className="mt-5 flex flex-col gap-2.5">
        {RUBRIC.map((r, i) => (
          <motion.li
            key={r.text}
            className="t-body flex items-start gap-2.5 text-ink"
            initial={reduce ? false : { opacity: 0, x: -8 }}
            animate={{ opacity: on ? 1 : 0, x: on ? 0 : -8 }}
            transition={{ duration: 0.4, delay: 0.9 + i * 0.18, ease }}
          >
            {r.ok ? <Check aria-hidden className="mt-1 size-4 shrink-0 text-success" strokeWidth={2.5} /> : <Minus aria-hidden className="mt-1 size-4 shrink-0 text-ink-3" />}
            {r.text}
          </motion.li>
        ))}
      </ul>
      <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-hairline/60 pt-4">
        <p className="t-body tabular text-ink"><span className="t-title">6</span> of 6 <span className="t-footnote ml-2 inline-flex items-center gap-1 text-ai"><Sparkles aria-hidden className="size-3" strokeWidth={1.75} />Suggested by AI</span></p>
        <span className="t-callout inline-flex h-8 items-center rounded-full bg-fog px-3.5 text-ink">Override score</span>
      </div>
    </div>
  )
}
