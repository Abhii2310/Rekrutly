import type { CSSProperties } from "react"
import { ramp } from "./film-scenes"

/** One glow colour per chapter. They fade into each other, so the room changes mood as the story moves. */
const GLOWS = ["#3B3B52", "#FF453A", "#5E5CE6", "#0A84FF", "#30D158", "#BF5AF2", "#64D2FF", "#FFD60A", "#FFD60A"]

/** Slow coloured light, drifting dots, and a vignette behind the whole film. */
export function Backdrop({ i, t }: { i: number; t: number }) {
  const c = GLOWS[i] ?? "#5E5CE6"
  const blob = (x: number, y: number, size: number, o: number, k: number): CSSProperties => ({
    left: `${x + Math.sin(t * 0.35 + k) * 6}%`, top: `${y + Math.cos(t * 0.3 + k) * 6}%`, width: size, height: size, backgroundColor: c, opacity: o, transition: "background-color 1.2s ease",
  })
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full blur-[90px]" style={blob(22, 62, 340, 0.3, 0)} />
      <div className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full blur-[110px]" style={blob(78, 30, 380, 0.22, 2)} />
      <div className="absolute inset-0 opacity-[0.07]" style={{ backgroundImage: "radial-gradient(#fff 1px, transparent 1px)", backgroundSize: "26px 26px", backgroundPosition: `0 ${(t * 8) % 26}px` }} />
      {Array.from({ length: 22 }, (_, k) => (
        <span key={k} className="absolute rounded-full bg-white" style={{ left: `${(k * 37) % 100}%`, top: `${100 - ((t * (3 + (k % 4)) + k * 13) % 110)}%`, width: 2 + (k % 3), height: 2 + (k % 3), opacity: 0.1 + (k % 5) * 0.05 }} />
      ))}
      <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse at center, transparent 55%, rgba(0,0,0,0.55) 100%)" }} />
    </div>
  )
}

const COLORS = ["#FFD60A", "#30D158", "#0A84FF", "#FF453A", "#BF5AF2", "#FFFFFF"]

/** A burst of confetti that plays once when the scene clock `l` reaches `at`. Positions come from the clock, so scrubbing is exact. */
export function Confetti({ l, at, x = 50, y = 40 }: { l: number; at: number; x?: number; y?: number }) {
  const p = ramp(l, at, at + 1.6)
  if (p <= 0 || p >= 1) return null
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0">
      {Array.from({ length: 34 }, (_, k) => {
        const a = k * 2.399
        const v = 90 + ((k * 53) % 140)
        return <span key={k} className="absolute block rounded-[2px]" style={{ left: `${x}%`, top: `${y}%`, width: 7, height: 11, background: COLORS[k % COLORS.length], opacity: 1 - p, transform: `translate(${Math.cos(a) * v * p}px, ${Math.sin(a) * v * p + 220 * p * p}px) rotate(${k * 40 + p * 520}deg)` }} />
      })}
    </div>
  )
}

/** The room lights, for the opening: dark, a flicker, then on. Opacity of a black sheet over the film. */
export function lightsOut(l: number): number {
  if (l < 0.7) return 0.93
  if (l < 0.95) return 0.35
  if (l < 1.15) return 0.9
  if (l < 1.3) return 0.25
  return 0.25 * (1 - ramp(l, 1.3, 2))
}
