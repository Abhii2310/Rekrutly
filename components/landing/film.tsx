"use client"

import * as React from "react"
import Link from "next/link"
import { ArrowRight, Pause, Play } from "lucide-react"
import { cn } from "cn"
import { Ravi, type Mood } from "./film-ravi"
import { Backdrop, Confetti, lightsOut } from "./film-fx"
import { SCENES, Scene, TOTAL, ramp } from "./film-scenes"

const MOODS: Mood[] = ["smile", "worry", "talk", "smile", "focus", "wow", "smile", "smile", "smile"]
const STARTS = SCENES.map((_, i) => SCENES.slice(0, i).reduce((n, s) => n + s.len, 0))

/**
 * A short animated film: Ravi, an HR manager, goes from five open tabs to the whole pipeline. It is plain React and SVG,
 * driven by one clock, so pausing and jumping to a chapter always show the right frame. Nothing here is live data.
 */
export function Film({ enter, enterLabel }: { enter: string; enterLabel: string }) {
  const [t, setT] = React.useState(0)
  // null means "automatic": plays, unless the person asked their device for less motion.
  const [choice, setChoice] = React.useState<boolean | null>(null)
  const reduced = React.useSyncExternalStore(
    (cb) => { const m = window.matchMedia("(prefers-reduced-motion: reduce)"); m.addEventListener("change", cb); return () => m.removeEventListener("change", cb) },
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    () => false,
  )
  const playing = choice ?? !reduced
  const [seen, setSeen] = React.useState(false)
  const box = React.useRef<HTMLDivElement>(null)

  // It only plays while it is on screen.
  React.useEffect(() => {
    const el = box.current
    if (!el) return
    const io = new IntersectionObserver(([e]) => setSeen(Boolean(e?.isIntersecting)), { threshold: 0.35 })
    io.observe(el)
    return () => io.disconnect()
  }, [])

  React.useEffect(() => {
    if (!playing || !seen) return
    let raf = 0
    let last = performance.now()
    const tick = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000)
      last = now
      setT((v) => (v + dt) % TOTAL)
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [playing, seen])

  const i = Math.max(0, STARTS.findLastIndex((s) => s <= t))
  const scene = SCENES[i] ?? SCENES[0]
  const l = t - (STARTS[i] ?? 0)
  const last = i === SCENES.length - 1
  const cta = (
    <Link href={enter} className="focus-ring inline-flex h-12 items-center gap-2 rounded-full bg-white px-8 text-[16px] font-medium text-black transition-transform hover:scale-[1.03]">{enterLabel}<ArrowRight aria-hidden className="size-4" strokeWidth={2.25} /></Link>
  )

  return (
    <div ref={box} className="mx-auto max-w-[1200px]">
      <div className="relative overflow-hidden rounded-[28px] border border-white/10 bg-[#08080C] p-4 shadow-[0_40px_120px_-30px_rgba(94,92,230,0.45)] sm:p-8">
        <Backdrop i={i} t={t} />
        <div className="relative mb-3 flex items-center justify-between text-[11px] uppercase tracking-[0.2em] text-white/45 sm:mb-5 sm:text-xs">
          <span>{String(i + 1).padStart(2, "0")} / {String(SCENES.length).padStart(2, "0")}</span>
          <span key={i} style={{ opacity: ramp(l, 0, 0.5) }} className="rounded-full border border-white/15 px-3 py-1 text-white/70">{scene.tag}</span>
        </div>
        <div className="relative grid items-end gap-4 sm:grid-cols-[minmax(0,0.42fr)_minmax(0,1fr)] sm:gap-8">
          <div className="relative flex h-44 items-end justify-center sm:h-[26rem]">
            <div aria-hidden className="absolute bottom-0 left-1/2 h-8 w-[80%] -translate-x-1/2 rounded-[50%] bg-black/60 blur-xl" />
            <div key={i} className="absolute left-1/2 top-0 w-[85%] rounded-2xl rounded-bl-sm bg-white px-4 py-2.5 text-center text-[14px] font-medium text-black shadow-[0_10px_40px_-10px_rgba(255,255,255,0.35)] sm:text-[17px]" style={{ opacity: Math.min(1, l * 3), transform: `translate(-50%, ${(1 - Math.min(1, l * 3)) * 10}px) scale(${0.94 + 0.06 * Math.min(1, l * 3)})` }}>{scene.say}</div>
            <div className="h-[78%] sm:h-[82%]"><Ravi mood={MOODS[i] ?? "smile"} t={t} wave={last} sparkle={i === 5 || i === 8} /></div>
          </div>
          <div className="relative min-h-[19rem] sm:h-[26rem]" aria-live="off">
            <div className="h-full" style={{ opacity: ramp(l, 0, 0.5), transform: `translateX(${(1 - ramp(l, 0, 0.5)) * 28}px) scale(${0.98 + 0.02 * ramp(l, 0, 0.5)})` }}><Scene i={i} l={l} t={t} enter={cta} /></div>
            {i === 3 ? <Confetti l={l} at={2.1} x={14} y={10} /> : null}
            {i === 5 ? <Confetti l={l} at={6.2} x={30} y={85} /> : null}
            {i === 8 ? <Confetti l={l} at={0.5} x={50} y={30} /> : null}
          </div>
        </div>
        {i === 0 ? <div aria-hidden className="pointer-events-none absolute inset-0 bg-black" style={{ opacity: lightsOut(l) }} /> : null}
        <p className="relative mt-6 text-balance text-center text-[19px] font-medium tracking-[-0.02em] text-white sm:text-[26px]">{scene.caption}</p>
        <div className="relative mt-5 flex items-center gap-3">
          <button type="button" onClick={() => setChoice(!playing)} aria-label={playing ? "Pause the film" : "Play the film"} className="focus-ring grid size-10 shrink-0 place-items-center rounded-full border border-white/20 text-white hover:bg-white/10">{playing ? <Pause className="size-4" /> : <Play className="size-4" />}</button>
          <div className="flex flex-1 gap-1.5" role="group" aria-label="Chapters">
            {SCENES.map((s, k) => (
              <button key={s.say} type="button" aria-label={`Chapter ${k + 1}: ${s.caption}`} onClick={() => setT(STARTS[k] ?? 0)} className="focus-ring group relative h-6 flex-1">
                <span className="absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 overflow-hidden rounded-full bg-white/15">
                  <span className={cn("block h-full bg-white")} style={{ width: `${k < i ? 100 : k === i ? Math.min(100, (l / s.len) * 100) : 0}%` }} />
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>
      <p className="mt-3 text-center text-[12px] text-white/40">An animated walkthrough. Names and numbers are made up for the film.</p>
    </div>
  )
}
