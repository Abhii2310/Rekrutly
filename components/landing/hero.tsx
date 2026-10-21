"use client"

import * as React from "react"
import Link from "next/link"
import { motion, useInView, useMotionValue, useReducedMotion, useSpring, useTransform } from "motion/react"
import { ArrowRight, Check, Sparkles } from "lucide-react"
import { cn } from "cn"
import { GLASS, Glow, GridBg, Spotlight } from "./fx"
import { useTicker } from "./use-ticker"

const WORDS = ["Hire", "with", "the", "lights", "on."]
const ease = [0.32, 0.72, 0, 1] as const
const SENTENCE = "Prepare a 30-minute full-stack developer assessment for the five candidates in this job. Show me the questions first."
const STEPS = ["Write 10 questions", "Create the assessment", "Create 5 candidate links", "Send invitations", "Track submissions", "Score and prepare reports"]
const LOOP = 170

/** The product window, playing the real flow on loop: type, plan, approve, receipts. */
function HeroWindow() {
  const ref = React.useRef<HTMLDivElement>(null)
  const visible = useInView(ref, { margin: "-10%" })
  const tick = useTicker(LOOP, 150, visible)
  const typed = SENTENCE.slice(0, Math.floor(SENTENCE.length * Math.min(1, tick / 40)))
  const approved = tick >= 98
  const done = approved ? Math.min(STEPS.length, Math.floor((tick - 100) / 6) + 1) : 0

  return (
    <div ref={ref} className={cn(GLASS, "shine-border mx-auto w-full max-w-[920px] overflow-hidden text-left shadow-[0_40px_120px_rgba(0,113,227,0.18)]")}>
      <div className="flex items-center gap-2 border-b border-white/10 bg-white/[0.03] px-4 py-3">
        <span className="size-2.5 rounded-full bg-white/15" /><span className="size-2.5 rounded-full bg-white/15" /><span className="size-2.5 rounded-full bg-white/15" />
        <span className="t-footnote ml-3 text-white/45">Command Centre</span>
      </div>
      <div className="grid md:grid-cols-[1.1fr_1fr]">
        <div className="min-h-[300px] p-5 sm:p-7">
          <p className="t-callout text-white/45">Tell Rekrutly what to do.</p>
          <div className="mt-3 min-h-[118px] rounded-[16px] border border-white/10 bg-white/[0.04] px-4 py-3.5">
            <p className="text-[16px] leading-7 text-white/90">
              {typed}
              {tick < 40 ? <span aria-hidden className="ml-0.5 inline-block h-[1.05em] w-px translate-y-0.5 bg-white" /> : null}
            </p>
          </div>
          <div className="mt-5 flex items-center gap-3">
            <span className={cn("t-callout inline-flex h-9 items-center rounded-full px-4 font-medium transition-all duration-300", approved ? "bg-[#30D158] text-black" : tick >= 85 ? "bg-white text-black" : "bg-white/15 text-white/50")}>
              {approved ? "Approved" : "Approve and create links"}
            </span>
            <span className="t-callout text-white/45">{approved ? "Running the steps" : tick >= 50 ? "Nothing has happened yet" : ""}</span>
          </div>
        </div>
        <div className="border-t border-white/10 p-5 sm:p-7 md:border-l md:border-t-0">
          <div className="flex items-center justify-between">
            <p className="t-headline text-white">Plan</p>
            <span className="t-footnote inline-flex items-center gap-1 text-[#A5A3FF]"><Sparkles aria-hidden className="size-3" strokeWidth={1.75} />Suggested by AI</span>
          </div>
          <ol className="mt-4 flex flex-col gap-3.5">
            {STEPS.map((s, i) => {
              const shown = tick >= 48 + i * 5
              const isDone = i < done
              const waiting = i > 0 && i < 4 && !approved
              return (
                <li key={s} className={cn("flex items-center gap-3 transition-all duration-300", shown ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0")}>
                  <span aria-hidden className={cn("flex size-5 shrink-0 items-center justify-center rounded-full border transition-colors duration-300", isDone ? "border-[#30D158] bg-[#30D158] text-black" : waiting ? "border-[#FFB340]" : "border-white/20")}>
                    {isDone ? <Check className="size-3" strokeWidth={3} /> : null}
                  </span>
                  <span className={cn("text-[15px]", isDone ? "text-white" : "text-white/60")}>{s}</span>
                  {waiting && shown ? <span className="t-footnote ml-auto text-[#FFB340]">Waiting for you</span> : null}
                </li>
              )
            })}
          </ol>
        </div>
      </div>
    </div>
  )
}

/** The window leans a few degrees toward the pointer. Flat for reduced motion and touch. */
function Tilt({ children }: { children: React.ReactNode }) {
  const reduce = useReducedMotion()
  const x = useMotionValue(0)
  const y = useMotionValue(0)
  const rx = useSpring(useTransform(y, [-0.5, 0.5], [4, -4]), { stiffness: 120, damping: 18 })
  const ry = useSpring(useTransform(x, [-0.5, 0.5], [-5, 5]), { stiffness: 120, damping: 18 })
  return (
    <div
      className="[perspective:1400px]"
      onPointerMove={(e) => {
        if (reduce || e.pointerType !== "mouse") return
        const r = e.currentTarget.getBoundingClientRect()
        x.set((e.clientX - r.left) / r.width - 0.5)
        y.set((e.clientY - r.top) / r.height - 0.5)
      }}
      onPointerLeave={() => { x.set(0); y.set(0) }}
    >
      <motion.div style={reduce ? undefined : { rotateX: rx, rotateY: ry, transformStyle: "preserve-3d" }}>{children}</motion.div>
    </div>
  )
}

/** Small cards that float around the window on large screens, each one a real moment from the product. */
function Satellites() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 z-10 hidden lg:block">
      <div className={cn(GLASS, "float-a absolute -left-16 -top-8 flex items-center gap-3 px-4 py-3")}>
        <span className="flex size-8 items-center justify-center rounded-full bg-[#30D158] text-black"><Check className="size-4" strokeWidth={3} /></span>
        <div><p className="t-callout font-medium text-white">Created 5 candidate links</p><p className="t-footnote text-white/45">Receipt saved</p></div>
      </div>
      <div className={cn(GLASS, "float-b absolute -right-12 top-44 px-5 py-4")}>
        <p className="t-footnote text-white/45">Question 8, SQL</p>
        <p className="mt-1 flex items-baseline gap-1.5 text-white"><span className="text-[36px] font-semibold leading-none tracking-[-0.03em]">6</span><span className="t-callout text-white/55">of 6</span></p>
        <p className="t-footnote mt-1 text-[#A5A3FF]">Suggested by AI</p>
      </div>
      <div className={cn(GLASS, "float-c absolute -bottom-6 left-24 flex items-center gap-3 px-4 py-3")}>
        <span className="relative flex size-2.5"><span className="pulse-ring absolute inset-0 rounded-full bg-[#FFB340]" /><span className="relative size-2.5 rounded-full bg-[#FFB340]" /></span>
        <div><p className="t-callout font-medium text-white">Nudge Kabir to start</p><p className="t-footnote text-white/45">Draft ready in हिन्दी</p></div>
      </div>
    </div>
  )
}

export function Hero({ signedIn }: { signedIn: boolean }) {
  const reduce = useReducedMotion()
  const enter = signedIn ? "/overview" : "/login"
  return (
    <Spotlight className="overflow-hidden px-5 pb-28 pt-36 text-center md:px-8 md:pb-40 md:pt-48">
      <Glow />
      <GridBg />
      <div className="relative">
        <motion.a
          href="#story"
          initial={reduce ? false : { opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease }}
          className="shine-border t-callout focus-ring inline-flex items-center gap-2 rounded-full bg-white/[0.05] px-4 py-1.5 text-white/80 backdrop-blur transition-colors hover:text-white"
        >
          <span aria-hidden className="size-1.5 rounded-full bg-[#30D158]" />
          The glass-box hiring agent
          <ArrowRight aria-hidden className="size-3.5" strokeWidth={2} />
        </motion.a>
        <h1 className="mx-auto mt-8 max-w-[900px] text-balance text-[56px] font-semibold leading-[0.96] tracking-[-0.045em] text-white sm:text-[88px] md:text-[120px]">
          {WORDS.map((w, i) => (
            <span key={w} className="inline-block">
              <motion.span
                className={cn("inline-block pb-[0.14em]", i >= 3 && "gradient-text")}
                initial={reduce ? false : { opacity: 0, y: 40, filter: "blur(14px)" }} animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                transition={{ duration: 0.9, delay: 0.15 + i * 0.09, ease }}
              >
                {w}
              </motion.span>
              {i < WORDS.length - 1 ? " " : null}
            </span>
          ))}
        </h1>
        <motion.p
          initial={reduce ? false : { opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.8, ease }}
          className="mx-auto mt-7 max-w-[520px] text-[19px] leading-8 text-white/55 md:text-[22px]"
        >
          The hiring agent that shows its work.
        </motion.p>
        <motion.div
          initial={reduce ? false : { opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.95, ease }}
          className="mt-10 flex flex-wrap items-center justify-center gap-3"
        >
          <Link href={enter} className="focus-ring inline-flex h-12 items-center gap-2 rounded-full bg-white px-8 text-[17px] font-medium text-black transition-transform duration-[160ms] hover:scale-[1.03]">
            {signedIn ? "Open the app" : "Try the demo"}<ArrowRight aria-hidden className="size-4" strokeWidth={2.25} />
          </Link>
          <a href="#story" className="focus-ring inline-flex h-12 items-center rounded-full border border-white/15 px-7 text-[17px] text-white transition-colors duration-[160ms] hover:bg-white/10">Watch it work</a>
        </motion.div>
        <motion.div
          initial={reduce ? false : { opacity: 0, y: 60, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: 1.1, delay: 1.1, ease }}
          className="relative mx-auto mt-20 max-w-[920px] md:mt-28"
        >
          <Tilt><HeroWindow /></Tilt>
          <Satellites />
        </motion.div>
      </div>
    </Spotlight>
  )
}
