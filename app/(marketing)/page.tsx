import type { Metadata } from "next"
import { cookies } from "next/headers"
import Link from "next/link"
import { Aurora } from "@/components/landing/aurora"
import { Hero } from "@/components/landing/hero"
import { LandingNav } from "@/components/landing/landing-nav"
import { Marquee } from "@/components/landing/marquee"
import { Reveal } from "@/components/landing/reveal"
import { Story } from "@/components/landing/story"
import { WarRoomDemo } from "@/components/landing/warroom-demo"
import { SESSION_COOKIE, verifySessionValue } from "@/lib/security/session"

const title = "Rekrutly: hire with the lights on"
const description = "The hiring agent that shows its work. It plans, you approve, it acts only when allowed, and it keeps a receipt for every step."

export const metadata: Metadata = {
  title: { absolute: title },
  description,
  robots: { index: true, follow: true },
  openGraph: { title, description, type: "website", siteName: "Rekrutly" },
  twitter: { card: "summary", title, description },
}

const PROMISES = [
  { word: "Receipts.", line: "Nothing happens off the record." },
  { word: "Locked keys.", line: "Answers never reach a candidate." },
  { word: "Your call.", line: "No automatic hiring decisions." },
]
const CHIPS = ["Hashed links", "Server-owned clock", "Signals, not proof", "Built for DPDP"]

export default async function LandingPage() {
  const jar = await cookies()
  const signedIn = verifySessionValue(jar.get(SESSION_COOKIE)?.value)
  const enter = signedIn ? "/overview" : "/login"

  return (
    <>
      <LandingNav signedIn={signedIn} />
      <main>
        <Hero signedIn={signedIn} />
        <Story />

        <section className="bg-mist px-5 py-28 md:px-8 md:py-40">
          <div className="mx-auto grid max-w-[1200px] items-center gap-12 md:grid-cols-[1fr_1.1fr] md:gap-20">
            <Reveal>
              <h2 className="text-[56px] font-semibold leading-[0.95] tracking-[-0.045em] text-ink md:text-[96px]">Everyone. Live.</h2>
              <p className="mt-6 text-[19px] text-ink-2 md:text-[22px]">Nothing to refresh.</p>
            </Reveal>
            <Reveal delay={0.1}><WarRoomDemo /></Reveal>
          </div>
        </section>

        <section className="overflow-hidden py-28 md:py-40">
          <Reveal className="px-5 md:px-8">
            <h2 className="mx-auto max-w-[1200px] text-[56px] font-semibold leading-[0.95] tracking-[-0.045em] text-ink md:text-[96px]">Their language.</h2>
          </Reveal>
          <div className="mt-14 md:mt-20"><Marquee /></div>
        </section>

        <section className="relative overflow-hidden bg-ink px-5 py-28 text-white md:px-8 md:py-44">
          <Aurora dark className="opacity-70" />
          <div className="relative mx-auto max-w-[1200px]">
            {PROMISES.map((p, i) => (
              <Reveal key={p.word} delay={i * 0.05} className="border-t border-white/15 py-8 md:py-12">
                <h2 className="text-[48px] font-semibold leading-none tracking-[-0.045em] md:text-[104px]">{p.word}</h2>
                <p className="mt-3 text-[17px] text-[#A1A1A6] md:text-[22px]">{p.line}</p>
              </Reveal>
            ))}
            <Reveal className="mt-12 flex flex-wrap gap-2.5 md:mt-16">
              {CHIPS.map((c) => <span key={c} className="t-callout rounded-full border border-white/20 px-4 py-2 text-white/85">{c}</span>)}
            </Reveal>
          </div>
        </section>

        <section className="relative overflow-hidden px-5 py-32 text-center md:px-8 md:py-48">
          <Aurora />
          <Reveal className="relative">
            <h2 className="mx-auto max-w-[900px] text-[56px] font-semibold leading-[0.95] tracking-[-0.045em] text-ink md:text-[112px]">
              Hire with the <span className="gradient-text">lights on.</span>
            </h2>
            <div className="mt-12 flex flex-wrap items-center justify-center gap-4">
              <Link href={enter} className="focus-ring inline-flex h-14 items-center rounded-full bg-action px-10 text-[19px] text-white transition-colors duration-[160ms] hover:bg-action-hover">{signedIn ? "Open the app" : "Try the demo"}</Link>
              <a href="https://github.com/Abhii2310/Rekrutly" className="focus-ring inline-flex h-14 items-center rounded-full px-7 text-[19px] text-ink transition-colors duration-[160ms] hover:bg-black/5">Read the code</a>
            </div>
          </Reveal>
        </section>
      </main>

      <footer className="px-5 pb-10 md:px-8">
        <p className="t-callout mx-auto max-w-[1200px] text-ink-2">Demo data and simulated candidates are always labelled.</p>
      </footer>
    </>
  )
}
