"use client"

import * as React from "react"
import Link from "next/link"
import { cn } from "cn"

const LINKS = [
  { href: "#how", label: "How it works" },
  { href: "#evidence", label: "Evidence" },
  { href: "#war-room", label: "War Room" },
  { href: "#trust", label: "Trust" },
]

/** Sticky top bar that gains a frosted background once the page scrolls. */
export function LandingNav() {
  const [scrolled, setScrolled] = React.useState(false)
  React.useEffect(() => {
    const on = () => setScrolled(window.scrollY > 8)
    on()
    window.addEventListener("scroll", on, { passive: true })
    return () => window.removeEventListener("scroll", on)
  }, [])
  return (
    <header className={cn("sticky top-0 z-30 border-b transition-colors duration-[160ms]", scrolled ? "border-hairline/60 bg-white/70 backdrop-blur-[20px] backdrop-saturate-[180%]" : "border-transparent bg-canvas")}>
      <div className="mx-auto flex h-14 w-full max-w-[1120px] items-center justify-between gap-6 px-5 md:px-8">
        <Link href="/welcome" className="focus-ring rounded-md text-[17px] font-semibold tracking-[-0.01em] text-ink">Rekrutly</Link>
        <nav aria-label="Page" className="hidden items-center gap-7 md:flex">
          {LINKS.map((l) => <a key={l.href} href={l.href} className="focus-ring t-callout rounded-md text-ink-2 transition-colors duration-[160ms] hover:text-ink">{l.label}</a>)}
        </nav>
        <Link href="/login" className="focus-ring t-callout inline-flex h-8 items-center rounded-full bg-action px-4 text-white transition-colors duration-[160ms] hover:bg-action-hover">Sign in</Link>
      </div>
    </header>
  )
}
