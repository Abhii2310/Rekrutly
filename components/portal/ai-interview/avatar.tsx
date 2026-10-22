"use client"

import * as React from "react"
import { cn } from "cn"

export type AvatarState = "idle" | "speaking" | "listening" | "thinking"

/**
 * The interviewer's face. While the voice speaks the mouth moves with it, and each word the voice reaches gives it a small
 * extra beat. It blinks, looks up while thinking and tilts its head while listening, so the candidate always knows what is
 * going on. It is a friendly cartoon, not a real person.
 */
export function InterviewerAvatar({ state, pulse, size = 168 }: { state: AvatarState; /** Goes up by one at every spoken word. */ pulse: number; size?: number }) {
  const mouth = React.useRef<SVGEllipseElement>(null)
  const smile = React.useRef<SVGPathElement>(null)
  const boost = React.useRef(0)
  const lastPulse = React.useRef(pulse)

  // A word was spoken: open wider for a moment.
  React.useEffect(() => {
    if (pulse !== lastPulse.current) { lastPulse.current = pulse; boost.current = 1 }
  }, [pulse])

  // Move the mouth by changing the shape directly, so it does not re-render the page sixty times a second.
  React.useEffect(() => {
    const reduce = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches
    let raf = 0
    let open = 0
    const set = (v: number) => {
      const m = mouth.current
      const s = smile.current
      if (!m || !s) return
      m.setAttribute("ry", String(1 + v * 11))
      m.setAttribute("rx", String(9 + v * 5))
      m.style.opacity = v > 0.08 ? "1" : "0"
      s.style.opacity = v > 0.08 ? "0" : "1"
    }
    if (state !== "speaking") { set(0); return }
    const start = performance.now()
    const tick = (now: number) => {
      const t = now - start
      boost.current = Math.max(0, boost.current - 0.07)
      const wobble = reduce ? (Math.floor(t / 420) % 2 ? 0.45 : 0.15) : 0.18 + 0.4 * Math.abs(Math.sin(t / 95)) * (0.7 + 0.3 * Math.abs(Math.sin(t / 310)))
      const target = Math.min(1, wobble + boost.current * 0.45)
      open += (target - open) * 0.45
      set(open)
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [state])

  const ring = state === "speaking" ? "bg-action/15 ring-action/40" : state === "listening" ? "bg-success/15 ring-success/40" : "bg-fog ring-transparent"
  const looking = state === "thinking"
  return (
    <div
      role="img" aria-label={state === "speaking" ? "The interviewer is speaking" : state === "listening" ? "The interviewer is listening" : state === "thinking" ? "The interviewer is thinking" : "The interviewer"}
      className={cn("relative mx-auto flex items-center justify-center rounded-full ring-4 transition-colors duration-300", ring, state === "speaking" && "avatar-halo")}
      style={{ width: size, height: size }}
    >
      <svg viewBox="0 0 200 200" width={size - 16} height={size - 16} aria-hidden className={cn(state === "speaking" && "avatar-bob", state === "listening" && "avatar-tilt")}>
        <defs>
          <clipPath id="avatar-clip"><circle cx="100" cy="100" r="96" /></clipPath>
          <linearGradient id="avatar-skin" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#F7D3B3" /><stop offset="1" stopColor="#EDBE98" /></linearGradient>
        </defs>
        <g clipPath="url(#avatar-clip)">
          <rect width="200" height="200" fill="#E8F1FD" />
          {/* shoulders and neck */}
          <path d="M10 210 C 20 160, 60 150, 100 150 C 140 150, 180 160, 190 210 Z" fill="#5E5CE6" />
          <rect x="86" y="128" width="28" height="30" rx="10" fill="#EDBE98" />
          {/* hair behind the head */}
          <path d="M42 96 C 36 44, 78 22, 100 22 C 128 22, 166 44, 158 96 C 158 70, 140 52, 100 52 C 62 52, 42 72, 42 96 Z" fill="#2B2A33" />
          {/* head */}
          <ellipse cx="100" cy="92" rx="48" ry="54" fill="url(#avatar-skin)" />
          {/* fringe */}
          <path d="M54 80 C 58 48, 84 38, 104 40 C 128 42, 148 56, 146 82 C 134 66, 112 60, 92 62 C 76 64, 62 70, 54 80 Z" fill="#2B2A33" />
          {/* cheeks */}
          <circle cx="68" cy="108" r="8" fill="#F4A8A0" opacity="0.35" />
          <circle cx="132" cy="108" r="8" fill="#F4A8A0" opacity="0.35" />
          {/* eyebrows */}
          <path d={state === "speaking" ? "M68 80 Q 78 74 88 79" : "M68 82 Q 78 78 88 81"} stroke="#2B2A33" strokeWidth="3" strokeLinecap="round" fill="none" />
          <path d={state === "speaking" ? "M112 79 Q 122 74 132 80" : "M112 81 Q 122 78 132 82"} stroke="#2B2A33" strokeWidth="3" strokeLinecap="round" fill="none" />
          {/* eyes */}
          <g className="avatar-blink">
            <ellipse cx="78" cy="96" rx="9" ry="10" fill="#fff" />
            <ellipse cx="122" cy="96" rx="9" ry="10" fill="#fff" />
            <circle cx={looking ? 81 : 78} cy={looking ? 92 : 97} r="5" fill="#2B2A33" />
            <circle cx={looking ? 125 : 122} cy={looking ? 92 : 97} r="5" fill="#2B2A33" />
            <circle cx={looking ? 83 : 80} cy={looking ? 90 : 95} r="1.6" fill="#fff" />
            <circle cx={looking ? 127 : 124} cy={looking ? 90 : 95} r="1.6" fill="#fff" />
          </g>
          {/* nose */}
          <path d="M100 104 Q 96 114 101 116" stroke="#D9A57F" strokeWidth="2.5" strokeLinecap="round" fill="none" />
          {/* mouth: a soft smile when quiet, an opening ellipse when speaking */}
          <path ref={smile} d="M84 130 Q 100 142 116 130" stroke="#9A3F4B" strokeWidth="4" strokeLinecap="round" fill="none" />
          <ellipse ref={mouth} cx="100" cy="133" rx="9" ry="1" fill="#7A2E3A" style={{ opacity: 0 }} />
        </g>
      </svg>
      {state === "thinking" ? (
        <span aria-hidden className="absolute -bottom-1 right-2 flex gap-1 rounded-full bg-canvas px-2 py-1 shadow">
          <i className="avatar-dot size-1.5 rounded-full bg-ink-2" /><i className="avatar-dot size-1.5 rounded-full bg-ink-2" style={{ animationDelay: "0.15s" }} /><i className="avatar-dot size-1.5 rounded-full bg-ink-2" style={{ animationDelay: "0.3s" }} />
        </span>
      ) : null}
    </div>
  )
}

/** Little bars that bounce while the candidate is being listened to. */
export function ListeningBars({ active }: { active: boolean }) {
  return (
    <div aria-hidden className="mx-auto mt-4 flex h-6 items-end justify-center gap-1">
      {[0, 1, 2, 3, 4].map((n) => (
        <i key={n} className={cn("w-1.5 rounded-full bg-success", active ? "avatar-bar" : "h-1 opacity-0")} style={active ? { animationDelay: `${n * 0.12}s` } : undefined} />
      ))}
    </div>
  )
}
