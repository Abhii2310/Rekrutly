"use client"

import * as React from "react"
import Link from "next/link"
import { cn } from "cn"

/** Minimal top bar: the name and one button. It gains a frosted background once the page scrolls. */
export function LandingNav({ signedIn }: { signedIn: boolean }) {
  const [scrolled, setScrolled] = React.useState(false)
  React.useEffect(() => {
    const on = () => setScrolled(window.scrollY > 8)
    on()
    window.addEventListener("scroll", on, { passive: true })
    return () => window.removeEventListener("scroll", on)
  }, [])
  return (
    <header className={cn("fixed inset-x-0 top-0 z-40 border-b transition-colors duration-[200ms]", scrolled ? "border-hairline/50 bg-white/90 backdrop-blur-[20px] backdrop-saturate-[180%]" : "border-transparent bg-transparent")}>
      <div className="mx-auto flex h-14 w-full max-w-[1200px] items-center justify-between px-5 md:px-8">
        <Link href="/" className="focus-ring rounded-md text-[19px] font-semibold tracking-[-0.02em] text-ink">Rekrutly</Link>
        <Link href={signedIn ? "/overview" : "/login"} className="focus-ring t-callout inline-flex h-9 items-center rounded-full bg-ink px-5 text-white transition-opacity duration-[160ms] hover:opacity-85">
          {signedIn ? "Open the app" : "Sign in"}
        </Link>
      </div>
    </header>
  )
}
