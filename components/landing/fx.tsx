"use client"

import * as React from "react"
import { cn } from "cn"

/** Big soft colour at the top of a dark section. Decorative only. */
export function Glow({ className }: { className?: string }) {
  return (
    <div aria-hidden className={cn("pointer-events-none absolute inset-0 overflow-hidden", className)}>
      <div className="absolute left-1/2 top-[-18%] h-[620px] w-[1100px] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,rgba(0,113,227,0.45),transparent)] blur-2xl" />
      <div className="aurora-a absolute -right-40 top-10 size-[520px] rounded-full bg-[radial-gradient(closest-side,rgba(94,92,230,0.38),transparent)] blur-2xl" />
      <div className="aurora-b absolute -left-40 top-40 size-[480px] rounded-full bg-[radial-gradient(closest-side,rgba(100,210,255,0.22),transparent)] blur-2xl" />
    </div>
  )
}

/** A faint grid that fades out toward the edges. */
export function GridBg({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn(
        "pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.05)_1px,transparent_1px)] bg-[size:56px_56px] [mask-image:radial-gradient(ellipse_at_50%_30%,#000_25%,transparent_72%)]",
        className,
      )}
    />
  )
}

/** A section where a soft light follows the pointer. The position is written straight to CSS, so nothing re-renders. */
export function Spotlight({ children, className }: { children: React.ReactNode; className?: string }) {
  const ref = React.useRef<HTMLDivElement>(null)
  return (
    <div
      ref={ref}
      className={cn("relative", className)}
      onPointerMove={(e) => {
        if (e.pointerType !== "mouse" || !ref.current) return
        const r = ref.current.getBoundingClientRect()
        ref.current.style.setProperty("--mx", `${e.clientX - r.left}px`)
        ref.current.style.setProperty("--my", `${e.clientY - r.top}px`)
      }}
    >
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(520px_circle_at_var(--mx,50%)_var(--my,20%),rgba(94,92,230,0.16),transparent_62%)]" />
      {children}
    </div>
  )
}

/** The glass surface used for every card on the landing page. */
export const GLASS = "rounded-[24px] border border-white/10 bg-white/[0.04] backdrop-blur-xl"
