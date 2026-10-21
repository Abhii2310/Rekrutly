"use client"

import * as React from "react"
import Link from "next/link"
import { motion, useMotionValue, useReducedMotion, useSpring, useTransform } from "motion/react"
import { Aurora } from "./aurora"
import { HeroDemo } from "./hero-demo"

const WORDS = ["Hire", "with", "the", "lights", "on."]
const ease = [0.32, 0.72, 0.0, 1] as const

/** The product window leans a few degrees toward the pointer, like a physical object. Flat for reduced motion and touch. */
function Tilt({ children }: { children: React.ReactNode }) {
  const reduce = useReducedMotion()
  const x = useMotionValue(0)
  const y = useMotionValue(0)
  const rx = useSpring(useTransform(y, [-0.5, 0.5], [5, -5]), { stiffness: 120, damping: 18 })
  const ry = useSpring(useTransform(x, [-0.5, 0.5], [-6, 6]), { stiffness: 120, damping: 18 })
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

export function Hero({ signedIn }: { signedIn: boolean }) {
  const reduce = useReducedMotion()
  return (
    <section className="relative overflow-hidden px-5 pb-24 pt-32 text-center md:px-8 md:pb-32 md:pt-44">
      <Aurora />
      <div className="relative">
        <motion.p
          initial={reduce ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease }}
          className="t-callout mx-auto inline-flex items-center gap-2 rounded-full border border-hairline/70 bg-white/70 px-3.5 py-1.5 text-ink-2 backdrop-blur"
        >
          <span aria-hidden className="size-1.5 rounded-full bg-success" />
          The glass-box hiring agent
        </motion.p>
        <h1 className="mx-auto mt-7 max-w-[860px] text-balance text-[56px] font-semibold leading-[0.95] tracking-[-0.045em] text-ink sm:text-[84px] md:text-[116px]">
          {WORDS.map((w, i) => (
            <span key={w} className="-mb-[0.18em] inline-block overflow-hidden align-bottom">
              <motion.span
                className={i >= 3 ? "gradient-text inline-block pb-[0.18em]" : "inline-block pb-[0.18em]"}
                initial={reduce ? false : { y: "108%" }} animate={{ y: 0 }}
                transition={{ duration: 0.9, delay: 0.15 + i * 0.09, ease }}
              >
                {w}
              </motion.span>
              {i < WORDS.length - 1 ? " " : null}
            </span>
          ))}
        </h1>
        <motion.p
          initial={reduce ? false : { opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.75, ease }}
          className="mx-auto mt-7 max-w-[520px] text-[19px] leading-8 text-ink-2 md:text-[22px]"
        >
          The hiring agent that shows its work.
        </motion.p>
        <motion.div
          initial={reduce ? false : { opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.9, ease }}
          className="mt-10 flex flex-wrap items-center justify-center gap-4"
        >
          <Link href={signedIn ? "/overview" : "/login"} className="focus-ring inline-flex h-12 items-center rounded-full bg-action px-8 text-[17px] text-white transition-colors duration-[160ms] hover:bg-action-hover">
            {signedIn ? "Open the app" : "Try the demo"}
          </Link>
          <a href="#story" className="focus-ring inline-flex h-12 items-center rounded-full px-6 text-[17px] text-ink transition-colors duration-[160ms] hover:bg-black/5">Watch it work</a>
        </motion.div>
        <motion.div
          initial={reduce ? false : { opacity: 0, y: 48 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 1, delay: 1.05, ease }}
          className="mt-16 md:mt-24"
        >
          <Tilt><HeroDemo /></Tilt>
        </motion.div>
      </div>
    </section>
  )
}
