"use client"

import Link from "next/link"

/** A floating glass pill: the name on the left, one button on the right. */
export function LandingNav({ signedIn }: { signedIn: boolean }) {
  return (
    <header className="fixed inset-x-0 top-4 z-40 flex justify-center px-4">
      <div className="flex h-12 w-full max-w-[640px] items-center justify-between rounded-full border border-white/10 bg-black/40 pl-6 pr-1.5 backdrop-blur-xl backdrop-saturate-150">
        <Link href="/" className="focus-ring rounded-md text-[17px] font-semibold tracking-[-0.02em] text-white">Rekrutly</Link>
        <nav aria-label="Page" className="hidden items-center gap-6 sm:flex">
          <a href="#story" className="focus-ring t-callout rounded-md text-white/60 transition-colors hover:text-white">Story</a>
          <a href="#more" className="focus-ring t-callout rounded-md text-white/60 transition-colors hover:text-white">Inside</a>
          <a href="#trust" className="focus-ring t-callout rounded-md text-white/60 transition-colors hover:text-white">Trust</a>
        </nav>
        <Link href={signedIn ? "/overview" : "/login"} className="focus-ring t-callout inline-flex h-9 items-center rounded-full bg-white px-5 font-medium text-black transition-opacity duration-[160ms] hover:opacity-85">
          {signedIn ? "Open the app" : "Sign in"}
        </Link>
      </div>
    </header>
  )
}
