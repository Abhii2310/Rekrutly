import type { Metadata } from "next"
import { passcodeRequired } from "@/lib/security/access"
import { cookies } from "next/headers"
import Link from "next/link"
import { ArrowRight } from "lucide-react"
import { Bento } from "@/components/landing/bento"
import { Glow, GridBg, Spotlight } from "@/components/landing/fx"
import { Film } from "@/components/landing/film"
import { Hero } from "@/components/landing/hero"
import { LandingNav } from "@/components/landing/landing-nav"
import { Marquee } from "@/components/landing/marquee"
import { Reveal } from "@/components/landing/reveal"
import { Story } from "@/components/landing/story"
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

const H2 = "text-balance text-[48px] font-semibold leading-[0.98] tracking-[-0.045em] text-white md:text-[88px]"

export default async function LandingPage() {
  const jar = await cookies()
  const signedIn = !passcodeRequired() || verifySessionValue(jar.get(SESSION_COOKIE)?.value)
  const enter = signedIn ? "/overview" : "/login"

  return (
    <div className="bg-[#050507] text-white [color-scheme:dark]">
      <LandingNav signedIn={signedIn} />
      <main>
        <Hero signedIn={signedIn} />
        <Story />

        <section id="film" className="relative scroll-mt-20 px-5 py-24 md:px-8 md:py-36">
          <Reveal className="mx-auto mb-10 max-w-[1200px] md:mb-14">
            <h2 className={H2}>Meet Ravi. Watch his day change.</h2>
          </Reveal>
          <Film enter={enter} enterLabel={signedIn ? "Open the app" : "Try the demo"} />
        </section>

        <section id="more" className="relative scroll-mt-20 px-5 py-28 md:px-8 md:py-40">
          <Reveal className="mx-auto mb-14 max-w-[1200px] md:mb-20">
            <h2 className={H2}>Everything, in one calm place.</h2>
          </Reveal>
          <Bento />
        </section>

        <section className="overflow-hidden py-24 md:py-36">
          <Marquee />
        </section>

        <Spotlight className="overflow-hidden px-5 py-28 md:px-8 md:py-44">
          <section id="trust" className="relative scroll-mt-20">
            <div className="mx-auto max-w-[1200px]">
              {PROMISES.map((p, i) => (
                <Reveal key={p.word} delay={i * 0.05} className="border-t border-white/10 py-8 md:py-12">
                  <h2 className="text-[48px] font-semibold leading-none tracking-[-0.045em] md:text-[104px]">{p.word}</h2>
                  <p className="mt-3 text-[17px] text-white/50 md:text-[22px]">{p.line}</p>
                </Reveal>
              ))}
              <Reveal className="mt-12 flex flex-wrap gap-2.5 md:mt-16">
                {CHIPS.map((c) => <span key={c} className="t-callout rounded-full border border-white/15 bg-white/[0.04] px-4 py-2 text-white/80">{c}</span>)}
              </Reveal>
            </div>
          </section>
        </Spotlight>

        <section className="relative overflow-hidden px-5 py-36 text-center md:px-8 md:py-52">
          <Glow />
          <GridBg />
          <Reveal className="relative">
            <h2 className="mx-auto max-w-[900px] text-balance text-[56px] font-semibold leading-[0.96] tracking-[-0.045em] md:text-[112px]">
              Hire with the <span className="gradient-text">lights on.</span>
            </h2>
            <div className="mt-12 flex flex-wrap items-center justify-center gap-3">
              <Link href={enter} className="focus-ring inline-flex h-14 items-center gap-2 rounded-full bg-white px-10 text-[19px] font-medium text-black transition-transform duration-[160ms] hover:scale-[1.03]">
                {signedIn ? "Open the app" : "Try the demo"}<ArrowRight aria-hidden className="size-5" strokeWidth={2.25} />
              </Link>
              <a href="https://github.com/Abhii2310/Rekrutly" className="focus-ring inline-flex h-14 items-center rounded-full border border-white/15 px-8 text-[19px] text-white transition-colors duration-[160ms] hover:bg-white/10">Read the code</a>
            </div>
          </Reveal>
        </section>
      </main>

      <footer className="px-5 pb-10 md:px-8">
        <p className="t-callout mx-auto max-w-[1200px] text-white/40">Demo data and simulated candidates are always labelled.</p>
      </footer>
    </div>
  )
}
