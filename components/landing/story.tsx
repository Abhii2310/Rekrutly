"use client"

import * as React from "react"
import { useMotionValueEvent, useScroll } from "motion/react"
import { Check, Sparkles } from "lucide-react"
import { cn } from "cn"

const SENTENCE = "Prepare a 30-minute full-stack developer assessment for the five candidates in this job. Show me the questions first."
const PLAN = ["Write 10 questions", "Create the assessment", "Create 5 candidate links", "Send invitations", "Track submissions", "Score and prepare reports"]
const RECEIPTS = ["Wrote 10 questions across 4 skills", "Published the assessment", "Created 5 candidate links", "Skipped email: not configured, links ready"]
const STAGES = [
  { word: "Say it.", line: "One sentence. Typed or spoken." },
  { word: "Plan.", line: "Real steps, real people. Nothing runs yet." },
  { word: "Approve.", line: "One tap on a full preview." },
  { word: "Act.", line: "Every step leaves a receipt." },
  { word: "Prove.", line: "Every score shows its evidence." },
]

const layer = (on: boolean) =>
  cn(
    "absolute inset-0 flex flex-col p-6 transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:transition-none sm:p-8",
    on ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-4 opacity-0",
  )

/**
 * The whole product in five scroll steps. The section is tall and its content is pinned, so scrolling plays the story:
 * say it, plan, approve, act, prove. Progress comes from the scroll position, not from a timer.
 */
export function Story() {
  const ref = React.useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end end"] })
  const [p, setP] = React.useState(0)
  useMotionValueEvent(scrollYProgress, "change", (v) => setP(Math.min(0.9999, Math.max(0, v))))
  const stage = Math.floor(p * STAGES.length)
  const within = p * STAGES.length - stage

  const typed = SENTENCE.slice(0, Math.floor(SENTENCE.length * (stage === 0 ? Math.min(1, within * 1.6) : 1)))
  const litSteps = stage === 1 ? Math.floor(within * 1.7 * PLAN.length) + 1 : stage > 1 ? PLAN.length : 0
  const pressed = stage > 2 || (stage === 2 && within > 0.45)
  const receipts = stage === 3 ? Math.floor(within * 1.6 * RECEIPTS.length) + 1 : stage > 3 ? RECEIPTS.length : 0

  return (
    <section id="story" ref={ref} className="relative h-[460vh]">
      <div className="sticky top-0 flex h-screen items-center overflow-hidden px-5 md:px-8">
        <div className="mx-auto grid w-full max-w-[1200px] items-center gap-8 md:grid-cols-[1fr_520px] md:gap-16">
          <div className="relative h-[150px] md:h-[300px]">
            {STAGES.map((s, i) => (
              <div
                key={s.word}
                aria-hidden={i !== stage}
                className={cn(
                  "absolute inset-0 flex flex-col justify-center transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:transition-none",
                  i === stage ? "translate-y-0 opacity-100" : i < stage ? "-translate-y-8 opacity-0" : "translate-y-8 opacity-0",
                )}
              >
                <h2 className="text-[56px] font-semibold leading-none tracking-[-0.045em] text-white sm:text-[80px] md:text-[128px]">{s.word}</h2>
                <p className="mt-4 text-[17px] text-white/55 md:mt-6 md:text-[22px]">{s.line}</p>
              </div>
            ))}
            <div aria-hidden className="absolute -bottom-2 left-0 flex gap-1.5 md:bottom-0">
              {STAGES.map((s, i) => (
                <span key={s.word} className="h-1 w-8 overflow-hidden rounded-full bg-white/15 md:w-12">
                  <span
                    className="block h-full origin-left rounded-full bg-white transition-transform duration-300"
                    style={{ transform: `scaleX(${i < stage ? 1 : i === stage ? Math.max(0.08, within) : 0})` }}
                  />
                </span>
              ))}
            </div>
          </div>

          <div className="relative mx-auto h-[330px] w-full max-w-[520px] overflow-hidden rounded-[22px] border border-white/10 bg-[#0B0B10] shadow-[0_30px_120px_rgba(94,92,230,0.25)] md:h-[400px]">
            <div className="absolute inset-x-0 top-0 flex items-center gap-2 border-b border-white/10 bg-white/[0.03] px-4 py-3">
              <span className="size-2.5 rounded-full bg-white/15" />
              <span className="size-2.5 rounded-full bg-white/15" />
              <span className="size-2.5 rounded-full bg-white/15" />
            </div>
            <div className="absolute inset-0 top-[41px]">
              {/* 0: say it */}
              <div className={layer(stage === 0)}>
                <p className="t-callout text-white/55">Tell Rekrutly what to do.</p>
                <div className="mt-3 min-h-[120px] rounded-[14px] border border-white/10 bg-white/[0.04] px-4 py-3.5">
                  <p className="text-[17px] leading-7 text-white">
                    {typed}
                    <span aria-hidden className="ml-0.5 inline-block h-[1.1em] w-px translate-y-1 animate-pulse bg-white" />
                  </p>
                </div>
              </div>

              {/* 1: plan */}
              <div className={layer(stage === 1)}>
                <div className="flex items-center justify-between">
                  <p className="t-headline text-white">Plan</p>
                  <span className="t-footnote text-[#A5A3FF]">Suggested by AI</span>
                </div>
                <ol className="mt-5 flex flex-col gap-4">
                  {PLAN.map((s, i) => (
                    <li key={s} className={cn("flex items-center gap-3 transition-all duration-300", i < litSteps ? "translate-x-0 opacity-100" : "-translate-x-2 opacity-25")}>
                      <span aria-hidden className={cn("flex size-5 shrink-0 items-center justify-center rounded-full border", i < litSteps ? "border-[#FFB340]" : "border-white/20")} />
                      <span className="text-[17px] text-white">{s}</span>
                      {i > 0 && i < 4 && i < litSteps ? <span className="t-footnote ml-auto text-[#FFB340]">Waiting for you</span> : null}
                    </li>
                  ))}
                </ol>
              </div>

              {/* 2: approve */}
              <div className={cn(layer(stage === 2), "items-center justify-center text-center")}>
                <p className="t-callout text-white/55">Nothing has happened yet.</p>
                <span className={cn("mt-6 inline-flex h-14 items-center gap-2 rounded-full px-9 text-[19px] transition-all duration-300", pressed ? "scale-95 bg-[#30D158] text-black" : "scale-100 bg-white text-black")}>
                  {pressed ? (
                    <>
                      <Check aria-hidden className="size-5" strokeWidth={3} />
                      Approved
                    </>
                  ) : (
                    "Approve and create links"
                  )}
                </span>
                <p className={cn("t-callout mt-5 text-white/55 transition-opacity duration-300", pressed ? "opacity-100" : "opacity-0")}>Now it runs, step by step.</p>
              </div>

              {/* 3: act */}
              <div className={layer(stage === 3)}>
                <p className="t-headline text-white">Receipts</p>
                <ul className="mt-5 flex flex-col gap-3.5">
                  {RECEIPTS.map((r, i) => (
                    <li key={r} className={cn("flex items-center gap-3 transition-all duration-300", i < receipts ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0")}>
                      <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-[#30D158] text-black">
                        <Check aria-hidden className="size-3" strokeWidth={3} />
                      </span>
                      <span className="text-[16px] text-white">{r}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* 4: prove */}
              <div className={layer(stage === 4)}>
                <p className="t-callout text-white/55">Question 8, SQL</p>
                <p className="mt-3 rounded-[14px] border border-white/10 bg-white/[0.04] px-4 py-3.5 text-[16px] leading-7 text-white">
                  An index lets the database{" "}
                  <span className="relative">
                    <span
                      aria-hidden
                      className="absolute inset-0 -mx-0.5 origin-left rounded-[4px] bg-[#5E5CE6]/50 transition-transform duration-700"
                      style={{ transform: `scaleX(${stage === 4 && within > 0.15 ? 1 : 0})` }}
                    />
                    <span className="relative">find rows without scanning the whole table</span>
                  </span>
                  , so lookups are much faster.
                </p>
                <div className="mt-auto flex items-center justify-between">
                  <p className="text-white">
                    <span className="text-[34px] font-semibold tracking-[-0.03em]">6</span> <span className="t-body text-white/55">of 6</span>
                  </p>
                  <span className="t-footnote inline-flex items-center gap-1 text-[#A5A3FF]">
                    <Sparkles aria-hidden className="size-3" strokeWidth={1.75} />
                    Suggested by AI
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
