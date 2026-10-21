"use client"

import * as React from "react"
import { motion, useInView, useReducedMotion } from "motion/react"
import { Check, ShieldCheck, Sparkles } from "lucide-react"
import { cn } from "cn"
import { GLASS } from "./fx"
import { useTicker } from "./use-ticker"

const ease = [0.32, 0.72, 0, 1] as const

function Tile({ title, line, className, children }: { title: string; line: string; className?: string; children: React.ReactNode }) {
  const reduce = useReducedMotion()
  return (
    <motion.div
      className={cn(GLASS, "group relative flex flex-col overflow-hidden p-6 transition-colors duration-300 hover:border-white/20 hover:bg-white/[0.06] md:p-7", className)}
      initial={reduce ? false : { opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-60px" }} transition={{ duration: 0.6, ease }}
    >
      <div className="relative min-h-[150px] flex-1">{children}</div>
      <h3 className="mt-6 text-[24px] font-semibold tracking-[-0.03em] text-white">{title}</h3>
      <p className="t-callout mt-1 text-white/50">{line}</p>
    </motion.div>
  )
}

function Live() {
  const ref = React.useRef<HTMLDivElement>(null)
  const visible = useInView(ref, { margin: "-10%" })
  const tick = useTicker(900, 60, visible, 100)
  const s = Math.floor(tick / 10)
  const rows = [
    { n: "Aarav", q: Math.min(10, 3 + Math.floor(s / 6)) },
    { n: "Diya", q: Math.min(10, 6 + Math.floor(s / 9)) },
    { n: "Kabir", q: 0 },
    { n: "Ishita", q: Math.min(10, 2 + Math.floor(s / 5)) },
  ]
  return (
    <div ref={ref} className="flex flex-col gap-2">
      {rows.map((r) => (
        <div key={r.n} className="flex items-center gap-3 rounded-[12px] bg-white/[0.04] px-3.5 py-2.5">
          <span key={r.q} className={cn("size-2 rounded-full", r.q === 0 ? "bg-white/20" : r.q >= 10 ? "bg-[#30D158]" : "bg-[#0A84FF] dot-pulse")} />
          <span className="text-[14px] text-white/90">{r.n}</span>
          <span className="t-footnote tabular ml-auto text-white/50">{r.q === 0 ? "Not started" : r.q >= 10 ? "Submitted" : `Question ${r.q} of 10`}</span>
        </div>
      ))}
    </div>
  )
}

function Evidence() {
  const ref = React.useRef<HTMLDivElement>(null)
  const on = useInView(ref, { once: true, margin: "-80px" })
  return (
    <div ref={ref}>
      <p className="rounded-[14px] border border-white/10 bg-white/[0.04] px-4 py-3.5 text-[15px] leading-7 text-white/85">
        An index lets the database{" "}
        <span className="relative">
          <span aria-hidden className="absolute inset-0 -mx-0.5 origin-left rounded-[4px] bg-[#5E5CE6]/50 transition-transform duration-[900ms] ease-[cubic-bezier(0.32,0.72,0,1)]" style={{ transform: `scaleX(${on ? 1 : 0})` }} />
          <span className="relative">find rows without scanning the table</span>
        </span>
        , so lookups are much faster.
      </p>
      <div className="mt-4 flex items-center justify-between">
        <span className="flex items-baseline gap-1.5 text-white"><span className="text-[34px] font-semibold leading-none tracking-[-0.03em]">6</span><span className="t-callout text-white/50">of 6</span></span>
        <span className="t-footnote inline-flex items-center gap-1 text-[#A5A3FF]"><Sparkles aria-hidden className="size-3" strokeWidth={1.75} />Suggested by AI</span>
      </div>
    </div>
  )
}

const LANGS = ["Hi Kabir", "नमस्ते Kabir", "ನಮಸ್ಕಾರ Kabir"]
function Languages() {
  const ref = React.useRef<HTMLDivElement>(null)
  const visible = useInView(ref, { margin: "-10%" })
  const tick = useTicker(90, 0, visible, 100)
  const idx = Math.floor(tick / 30) % 3
  return (
    <div ref={ref} className="flex h-full flex-col justify-center gap-3">
      {LANGS.map((l, i) => (
        <span key={l} className={cn("text-[34px] font-semibold leading-tight tracking-[-0.03em] transition-all duration-500", i === idx ? "translate-x-0 text-white opacity-100" : "translate-x-2 text-white/25 opacity-70")}>{l}</span>
      ))}
    </div>
  )
}

function Receipts() {
  const items = ["Wrote 10 questions", "Published the assessment", "Created 5 links", "You approved"]
  return (
    <ul className="flex flex-col gap-2.5">
      {items.map((t) => (
        <li key={t} className="flex items-center gap-3 text-[14px] text-white/85">
          <span className="flex size-5 items-center justify-center rounded-full bg-[#30D158] text-black"><Check className="size-3" strokeWidth={3} /></span>{t}
        </li>
      ))}
    </ul>
  )
}

function Guardrail() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-7 text-center">
      <span className="relative flex size-14 items-center justify-center rounded-full bg-white/[0.06] text-white"><span className="pulse-ring absolute inset-0 rounded-full border border-[#FFB340]/60" /><ShieldCheck className="size-6" strokeWidth={1.75} /></span>
      <p className="text-[18px] text-white/90"><span className="text-white/40 line-through decoration-[#FFB340]">under 30</span></p>
    </div>
  )
}

function Compare() {
  const bars = [[86, 52], [64, 90], [72, 70]]
  return (
    <div className="flex h-full flex-col justify-center gap-4">
      {bars.map(([a, b], i) => (
        <div key={i} className="flex flex-col gap-1.5">
          <span className="h-1.5 rounded-full bg-white" style={{ width: `${a}%` }} />
          <span className="h-1.5 rounded-full bg-white/30" style={{ width: `${b}%` }} />
        </div>
      ))}
    </div>
  )
}

/** Six tiles, each a picture of one thing the product does. A few words each. */
export function Bento() {
  return (
    <div className="mx-auto grid max-w-[1200px] gap-4 md:grid-cols-6">
      <Tile title="Everyone, live." line="Nothing to refresh." className="md:col-span-3"><Live /></Tile>
      <Tile title="Evidence." line="Exact words, exact points." className="md:col-span-3"><Evidence /></Tile>
      <Tile title="Receipts." line="For every action." className="md:col-span-2"><Receipts /></Tile>
      <Tile title="Any language." line="You press send." className="md:col-span-2"><Languages /></Tile>
      <Tile title="Guardrails." line="Bias out before the AI." className="md:col-span-2"><Guardrail /></Tile>
      <Tile title="Side by side." line="No winner picked." className="md:col-span-6"><Compare /></Tile>
    </div>
  )
}
