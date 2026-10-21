import type { Metadata } from "next"
import Link from "next/link"
import { Check } from "lucide-react"
import { CountUp } from "@/components/landing/count-up"
import { EvidenceDemo } from "@/components/landing/evidence-demo"
import { HeroDemo } from "@/components/landing/hero-demo"
import { LandingNav } from "@/components/landing/landing-nav"
import { LanguageDemo } from "@/components/landing/language-demo"
import { Reveal } from "@/components/landing/reveal"
import { WarRoomDemo } from "@/components/landing/warroom-demo"

const title = "Rekrutly: the hiring agent that shows its work"
const description = "Tell Rekrutly what you need. It plans, you approve, it acts only when allowed, and it keeps a receipt for every step. Built for startup hiring teams in India."

export const metadata: Metadata = {
  title: { absolute: title },
  description,
  robots: { index: true, follow: true },
  openGraph: { title, description, type: "website", siteName: "Rekrutly" },
  twitter: { card: "summary", title, description },
}

const STEPS = [
  { n: "1", title: "You ask", body: "Type or speak one instruction. A guardrail removes anything about age, gender, caste, religion or other protected traits before the AI sees it." },
  { n: "2", title: "You approve", body: "Rekrutly shows the plan, the questions and what will happen. Nothing runs until you say yes, and you can edit first." },
  { n: "3", title: "It acts, and records", body: "Only allow-listed actions run. Every step leaves a receipt you can read, and AI judgements are labelled and overridable." },
]

const TRUST = [
  ["A receipt for every action", "Append-only. Nothing is edited after the fact."],
  ["Answer keys stay on the server", "Candidates never receive a key, a rubric or a model answer."],
  ["Links are hashed and encrypted", "A candidate link cannot be read from the database."],
  ["The server owns the clock", "Deadlines are enforced on every save, not by the browser."],
  ["Signals, not proof", "Tab switches are disclosed to candidates and shown as hints."],
  ["No automatic hiring decisions", "AI scores are suggestions, and no one is labelled best."],
]

export default function Welcome() {
  return (
    <>
      <LandingNav />
      <main>
        {/* Hero */}
        <section className="px-5 pb-20 pt-16 text-center md:px-8 md:pb-28 md:pt-24">
          <Reveal>
            <p className="t-callout text-ink-2">The glass-box hiring agent</p>
            <h1 className="mx-auto mt-4 max-w-[860px] text-[40px] font-semibold leading-[1.04] tracking-[-0.03em] text-ink sm:text-[56px] md:text-[72px]">
              The hiring agent that shows its work.
            </h1>
            <p className="mx-auto mt-6 max-w-[600px] text-[17px] leading-7 text-ink-2 md:text-[19px] md:leading-8">
              Tell Rekrutly what you need. It plans, you approve, it acts only when allowed, and it keeps a receipt for every step.
            </p>
            <div className="mt-9 flex flex-wrap items-center justify-center gap-x-6 gap-y-3">
              <Link href="/login" className="focus-ring inline-flex h-11 items-center rounded-full bg-action px-7 text-[17px] text-white transition-colors duration-[160ms] hover:bg-action-hover">Sign in to the demo</Link>
              <a href="#how" className="focus-ring rounded-md text-[17px] text-action transition-colors duration-[160ms] hover:text-action-hover">See how it works</a>
            </div>
          </Reveal>
          <Reveal delay={0.15} y={28} className="mt-14 md:mt-20">
            <HeroDemo />
            <p className="t-callout mt-5 text-ink-2">A recording of the real flow: one instruction, a plan, an approval, and the receipts.</p>
          </Reveal>
        </section>

        {/* How it works */}
        <section id="how" className="scroll-mt-14 bg-mist px-5 py-20 md:px-8 md:py-28">
          <div className="mx-auto max-w-[1120px]">
            <Reveal><h2 className="max-w-[640px] text-[32px] font-semibold leading-[1.1] tracking-[-0.025em] text-ink md:text-[48px]">AI proposes. People approve. Code executes.</h2></Reveal>
            <div className="mt-12 grid gap-10 md:mt-16 md:grid-cols-3 md:gap-12">
              {STEPS.map((s, i) => (
                <Reveal key={s.n} delay={i * 0.1}>
                  <p aria-hidden className="tabular text-[56px] font-semibold leading-none tracking-[-0.03em] text-fog">{s.n}</p>
                  <h3 className="t-title mt-4 text-ink">{s.title}</h3>
                  <p className="t-body mt-2 text-ink-2">{s.body}</p>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* Evidence */}
        <section id="evidence" className="scroll-mt-14 px-5 py-20 md:px-8 md:py-28">
          <div className="mx-auto grid max-w-[1120px] items-center gap-12 md:grid-cols-2 md:gap-16">
            <Reveal>
              <h2 className="text-[32px] font-semibold leading-[1.1] tracking-[-0.025em] text-ink md:text-[48px]">Evidence, not vibes.</h2>
              <p className="mt-5 max-w-[460px] text-[17px] leading-7 text-ink-2">
                Multiple-choice answers are scored by plain code. Written answers get an AI suggestion with the exact words it relied on and the rubric points matched and missing. You can override any score, with a reason, and both are recorded.
              </p>
              <p className="t-callout mt-4 text-ink-2">Compare two to four candidates side by side. Rekrutly never picks a winner.</p>
            </Reveal>
            <Reveal delay={0.1}><EvidenceDemo /></Reveal>
          </div>
        </section>

        {/* War Room */}
        <section id="war-room" className="scroll-mt-14 bg-mist px-5 py-20 md:px-8 md:py-28">
          <div className="mx-auto grid max-w-[1120px] items-center gap-12 md:grid-cols-2 md:gap-16">
            <Reveal className="md:order-2">
              <h2 className="text-[32px] font-semibold leading-[1.1] tracking-[-0.025em] text-ink md:text-[48px]">Everyone, at a glance.</h2>
              <p className="mt-5 max-w-[460px] text-[17px] leading-7 text-ink-2">
                The War Room shows who is on which question, how much time is left, and what needs you. It updates by itself, so you can keep it open next to a candidate&apos;s phone.
              </p>
            </Reveal>
            <Reveal delay={0.1} className="md:order-1"><WarRoomDemo /></Reveal>
          </div>
        </section>

        {/* Languages */}
        <section className="px-5 py-20 md:px-8 md:py-28">
          <div className="mx-auto grid max-w-[1120px] items-center gap-12 md:grid-cols-2 md:gap-16">
            <Reveal>
              <h2 className="text-[32px] font-semibold leading-[1.1] tracking-[-0.025em] text-ink md:text-[48px]">Follow up in the language they reply in.</h2>
              <p className="mt-5 max-w-[460px] text-[17px] leading-7 text-ink-2">
                Rekrutly drafts a warm nudge in English, Hindi or Kannada, with a shorter version for WhatsApp. WhatsApp opens with the text filled in. You press send.
              </p>
            </Reveal>
            <Reveal delay={0.1}><LanguageDemo /></Reveal>
          </div>
        </section>

        {/* Numbers */}
        <section className="border-y border-hairline/60 px-5 py-14 md:px-8 md:py-20">
          <div className="mx-auto grid max-w-[1120px] grid-cols-2 gap-x-6 gap-y-10 md:grid-cols-4">
            {[
              { to: 100, suffix: "%", label: "of actions leave a receipt" },
              { to: 0, suffix: "", label: "messages sent without your click" },
              { to: 3, suffix: "", label: "languages for follow-ups" },
              { to: 30, suffix: "s", label: "grace after the timer, enforced by the server" },
            ].map((s, i) => (
              <Reveal key={s.label} delay={i * 0.08}>
                <p className="text-[44px] font-semibold leading-none tracking-[-0.03em] text-ink md:text-[56px]"><CountUp to={s.to} suffix={s.suffix} /></p>
                <p className="t-callout mt-2 max-w-[200px] text-ink-2">{s.label}</p>
              </Reveal>
            ))}
          </div>
        </section>

        {/* Trust */}
        <section id="trust" className="scroll-mt-14 px-5 py-20 md:px-8 md:py-28">
          <div className="mx-auto max-w-[1120px]">
            <Reveal>
              <h2 className="max-w-[640px] text-[32px] font-semibold leading-[1.1] tracking-[-0.025em] text-ink md:text-[48px]">Trust is the product.</h2>
              <p className="mt-5 max-w-[560px] text-[17px] leading-7 text-ink-2">
                Hiring decisions affect people. So the agent is built to be read, questioned and corrected, and designed toward India&apos;s DPDP Rules, which apply in full from May 2027.
              </p>
            </Reveal>
            <ul className="mt-12 grid gap-x-12 gap-y-0 md:grid-cols-2">
              {TRUST.map(([head, body], i) => (
                <li key={head} className="border-t border-hairline/70">
                  <Reveal delay={(i % 2) * 0.08}>
                    <div className="flex items-start gap-3.5 py-5">
                      <Check aria-hidden className="mt-1 size-4 shrink-0 text-ink" strokeWidth={2.5} />
                      <div><p className="t-headline text-ink">{head}</p><p className="t-body mt-0.5 text-ink-2">{body}</p></div>
                    </div>
                  </Reveal>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Final call to action */}
        <section className="bg-mist px-5 py-24 text-center md:px-8 md:py-32">
          <Reveal>
            <h2 className="mx-auto max-w-[760px] text-[36px] font-semibold leading-[1.08] tracking-[-0.03em] text-ink md:text-[56px]">Others are building agents that act alone. Build one your team can trust.</h2>
            <div className="mt-9 flex flex-wrap items-center justify-center gap-x-6 gap-y-3">
              <Link href="/login" className="focus-ring inline-flex h-11 items-center rounded-full bg-action px-7 text-[17px] text-white transition-colors duration-[160ms] hover:bg-action-hover">Sign in to the demo</Link>
              <a href="https://github.com/Abhii2310/Rekrutly" className="focus-ring rounded-md text-[17px] text-action transition-colors duration-[160ms] hover:text-action-hover">Read the code</a>
            </div>
          </Reveal>
        </section>
      </main>

      <footer className="px-5 py-10 md:px-8">
        <div className="mx-auto flex max-w-[1120px] flex-wrap items-center justify-between gap-4">
          <p className="t-callout text-ink-2">Rekrutly. Demo data and simulated candidates are always labelled.</p>
          <p className="t-callout text-ink-2">Built for startup hiring teams in India.</p>
        </div>
      </footer>
    </>
  )
}
