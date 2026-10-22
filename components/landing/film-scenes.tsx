import type { CSSProperties, ReactNode } from "react"
import { cn } from "cn"
import { Check, Eye, Sparkles } from "lucide-react"

const clamp = (n: number) => Math.min(1, Math.max(0, n))
/** 0 to 1 as the scene clock `l` moves from a to b. */
export const ramp = (l: number, a: number, b: number): number => clamp((l - a) / (b - a))
const pop = (l: number, a: number): CSSProperties => ({ opacity: ramp(l, a, a + 0.35), transform: `translateY(${(1 - ramp(l, a, a + 0.35)) * 14}px) scale(${0.97 + 0.03 * ramp(l, a, a + 0.35)})` })

const Card = ({ children, className, style }: { children: ReactNode; className?: string; style?: CSSProperties }) => (
  <div style={style} className={cn("rounded-2xl border border-white/10 bg-white/[0.05] p-4 text-[13px] text-white/90 backdrop-blur sm:p-5 sm:text-[15px]", className)}>{children}</div>
)
const Tag = ({ children, tone = "ai" }: { children: ReactNode; tone?: "ai" | "ok" | "warn" }) => (
  <span className={cn("rounded-full px-2.5 py-0.5 text-[11px] font-medium sm:text-xs", tone === "ai" && "bg-[#5E5CE6]/25 text-[#B9B8FF]", tone === "ok" && "bg-[#30D158]/20 text-[#7BE495]", tone === "warn" && "bg-[#FF9F0A]/20 text-[#FFC266]")}>{children}</span>
)

export const SCENES = [
  { len: 7, say: "Five tools. One hiring day.", caption: "Hiring today is five tabs." },
  { len: 8, say: "Watch. I just say it.", caption: "One sentence. AI proposes the plan." },
  { len: 7, say: "I approve. Nothing runs before.", caption: "You approve. Code executes. Every step leaves a receipt." },
  { len: 8, say: "The exam watches, fairly.", caption: "Camera-proctored exams, built in. Signals, not proof." },
  { len: 9, say: "Now: how do they use AI?", caption: "We test how people work with AI, not just what they know." },
  { len: 6, say: "Everyone on one board.", caption: "From resume match to offer, in one place." },
  { len: 6, say: "Even a no gives something.", caption: "Rejected candidates get a private report of their own skills." },
  { len: 6, say: "Hire with the lights on.", caption: "Rekrutly. The hiring agent that shows its work." },
] as const

export const TOTAL = SCENES.reduce((n, s) => n + s.len, 0)

const TABS = ["Test site", "ATS", "Email", "Spreadsheet", "Interview tool"]
const SENTENCE = "Prepare a 30-minute full-stack assessment for the five candidates in this job. Show me the questions first."
const PLAN = ["Write 10 questions", "Create the assessment", "Create 5 candidate links", "Send invitations", "Score and prepare reports"]
const STAGES = ["Resume match", "Test", "AI interview", "Interview", "Offer"]

export function Scene({ i, l, t, enter }: { i: number; l: number; t: number; enter: ReactNode }): ReactNode {
  if (i === 0) return (
    <div className="relative h-full">
      {TABS.map((n, k) => (
        <div key={n} style={{ ...pop(l, 0.3 + k * 0.45), left: `${6 + (k % 3) * 31}%`, top: `${8 + Math.floor(k / 3) * 38 + Math.sin(t * 1.6 + k) * 2}%` }} className="absolute">
          <Card className="w-[9.5rem] sm:w-48"><span className="text-white/50">Tab {k + 1}</span><br /><span className="font-medium">{n}</span></Card>
        </div>
      ))}
      <div style={pop(l, 3.2)} className="absolute bottom-3 right-3"><Tag tone="warn">Copy, paste, repeat</Tag></div>
    </div>
  )
  if (i === 1) {
    const typed = SENTENCE.slice(0, Math.floor(SENTENCE.length * ramp(l, 0.4, 3.2)))
    const lit = Math.floor(ramp(l, 3.8, 7.2) * PLAN.length + 0.001)
    return (
      <div className="flex h-full flex-col gap-3">
        <Card><span className="text-white/45">Tell Rekrutly</span><p className="mt-1">{typed}<span className="ml-0.5 inline-block h-4 w-0.5 translate-y-0.5 bg-white" style={{ opacity: Math.floor(t * 2) % 2 }} /></p></Card>
        <Card style={pop(l, 3.5)}>
          <div className="mb-2 flex items-center gap-2 font-medium"><Sparkles className="size-4 text-[#B9B8FF]" />Plan<Tag>Suggested by AI</Tag></div>
          <ul className="grid gap-1.5">{PLAN.map((s, k) => <li key={s} className="flex items-center gap-2" style={{ opacity: k < lit ? 1 : 0.25 }}><span className={cn("grid size-4 place-items-center rounded-full", k < lit ? "bg-[#30D158] text-black" : "bg-white/15")}>{k < lit ? <Check className="size-3" strokeWidth={3} /> : null}</span>{s}</li>)}</ul>
        </Card>
      </div>
    )
  }
  if (i === 2) {
    const pressed = l > 2
    const links = Math.floor(ramp(l, 2.6, 5.4) * 5 + 0.001)
    return (
      <div className="flex h-full flex-col justify-between gap-3">
        <div className="relative">
          <button type="button" tabIndex={-1} aria-hidden className={cn("h-11 rounded-full px-8 text-[15px] font-medium transition-transform", pressed ? "scale-95 bg-[#30D158] text-black" : "bg-white text-black")}>{pressed ? "Approved" : "Approve"}</button>
          <div className="absolute" style={{ left: `${40 - ramp(l, 0, 1.8) * 30}%`, top: `${70 - ramp(l, 0, 1.8) * 40}px`, opacity: ramp(l, 0, 0.3) * (1 - ramp(l, 2.6, 3)) }}><div className="size-4 rotate-[-20deg] border-l-[10px] border-t-[16px] border-l-transparent border-t-white" /></div>
        </div>
        <Card>
          <ul className="grid gap-1.5">{["Ananya", "Ritesh", "Devansh", "Chahat", "Rushabh"].map((n, k) => <li key={n} className="flex items-center justify-between" style={{ opacity: k < links ? 1 : 0.2 }}><span>{n}</span><span className="text-white/55">{k < links ? "link ready" : "waiting"}</span></li>)}</ul>
        </Card>
        <p className="text-[12px] text-white/50 sm:text-sm" style={pop(l, 5.4)}>Receipt: Created 5 candidate links</p>
      </div>
    )
  }
  if (i === 3) {
    const secs = Math.max(0, 1800 - Math.floor(l * 95))
    const box = Math.sin(t * 1.4) * 3
    return (
      <div className="grid h-full grid-cols-2 gap-3">
        <Card className="relative overflow-hidden p-0">
          <div className="grid h-full min-h-28 place-items-center bg-black/40">
            <div className="relative h-24 w-20 rounded-[40%] bg-[#E0A982]/80" style={{ transform: `translateX(${box}px)` }}>
              <div className="absolute -inset-2 rounded-xl border-2 border-[#30D158]" />
            </div>
          </div>
          <span className="absolute bottom-2 left-2"><Tag tone="ok"><Eye className="mr-1 inline size-3" />Face detected</Tag></span>
        </Card>
        <div className="flex flex-col gap-3">
          <Card><span className="text-white/50">Time left</span><p className="text-2xl font-semibold tabular-nums sm:text-3xl">{String(Math.floor(secs / 60)).padStart(2, "0")}:{String(secs % 60).padStart(2, "0")}</p><p className="text-white/45">Server-owned clock</p></Card>
          <Card style={pop(l, 3)}><span className="text-white/50">Signals</span><p className="mt-1">Nothing flagged</p><p className="text-white/45">A person reviews any hint</p></Card>
        </div>
      </div>
    )
  }
  if (i === 4) {
    const fixed = l > 6.2
    return (
      <div className="flex h-full flex-col gap-2.5">
        <Card style={pop(l, 0.3)} className="self-end"><span className="text-white/45">Candidate</span><br />Write the refund email.</Card>
        <Card style={pop(l, 1.6)} className="self-start"><span className="text-white/45">AI assistant</span><br />Refunds are processed within <span className={cn("rounded px-1", fixed ? "bg-[#FF453A]/25 line-through" : "bg-white/10")}>30 days</span>.</Card>
        <Card style={pop(l, 3.4)} className="self-end"><span className="text-white/45">Candidate checks the brief</span><br />Wait. The brief says 7 days.</Card>
        <Card style={{ ...pop(l, 6.2), borderColor: "rgba(48,209,88,0.5)" }}><div className="flex items-center gap-2 font-medium"><Check className="size-4 text-[#30D158]" strokeWidth={3} />Judgment Card<Tag tone="ok">Caught and fixed it</Tag></div><p className="mt-1 text-white/55">Planted mistake, found and corrected before sending.</p></Card>
      </div>
    )
  }
  if (i === 5) {
    const at = Math.min(4, Math.floor(ramp(l, 0.8, 4.6) * 4.999))
    return (
      <div className="grid h-full grid-cols-5 gap-1.5 sm:gap-2">
        {STAGES.map((s, k) => (
          <div key={s} className="rounded-xl border border-white/10 bg-white/[0.04] p-1.5 sm:p-2.5">
            <p className="mb-2 text-[10px] text-white/50 sm:text-xs">{s}</p>
            {k === at ? <div className="rounded-lg bg-white px-1.5 py-2 text-[11px] font-medium text-black transition-all sm:text-sm">Ritesh</div> : <div className="h-8 rounded-lg bg-white/[0.05]" />}
          </div>
        ))}
      </div>
    )
  }
  if (i === 6) return (
    <Card className="h-full">
      <p className="font-medium">Your report, Chahat</p>
      <p className="mb-3 text-white/45">Only you can see this. No ranking, no answers.</p>
      {[["React", 82], ["APIs", 66], ["SQL", 38]].map(([n, v], k) => (
        <div key={n as string} className="mb-3"><div className="mb-1 flex justify-between"><span>{n}</span><span className="tabular-nums text-white/60">{Math.round(ramp(l, 0.4 + k * 0.5, 2.4 + k * 0.5) * (v as number))}%</span></div><div className="h-2 rounded-full bg-white/10"><div className="h-full rounded-full bg-white" style={{ width: `${ramp(l, 0.4 + k * 0.5, 2.4 + k * 0.5) * (v as number)}%` }} /></div></div>
      ))}
      <p style={pop(l, 3.8)} className="text-white/80">Practise next: SQL. Solve three short problems and explain each out loud.</p>
    </Card>
  )
  return (
    <div className="flex h-full flex-col items-center justify-center gap-5 text-center">
      <p style={pop(l, 0.2)} className="text-balance text-[34px] font-semibold leading-[0.98] tracking-[-0.04em] sm:text-[60px]">Hire with the <span className="text-[#7DB5FF]">lights on.</span></p>
      <div style={pop(l, 1.2)}>{enter}</div>
    </div>
  )
}
