import { StateMessage, PortalShell } from "@/components/portal/shell"
import { getDb } from "@/lib/db/server"
import { growthReport } from "@/lib/growth/report"
import { hashToken } from "@/lib/security/tokens"

export const dynamic = "force-dynamic"
const SHAPE = /^[A-Za-z0-9_-]{43}$/

type Row = {
  candidates: { full_name: string; stage: string; jobs: { title: string } | null } | null
  submissions: { scoring_status: string; final_score: number | null; final_max: number | null; skill_breakdown: { skill: string; percent: number }[] | null } | { scoring_status: string; final_score: number | null; final_max: number | null; skill_breakdown: { skill: string; percent: number }[] | null }[] | null
}

/** A private report for the candidate: their own skill results and what to practise. No ranking, no comparison, no answers. */
export default async function GrowthPage({ params }: { params: Promise<{ token: string }> }) {
  const { token: raw } = await params
  const token = raw.trim().replace(/[^A-Za-z0-9_-]+$/, "")
  const nope = <StateMessage title="This report isn't available.">Open the newest email from the hiring team and tap the link in it.</StateMessage>
  if (!SHAPE.test(token)) return nope
  const q = await getDb().from("invitations").select("candidates(full_name, stage, jobs(title)), submissions(scoring_status, final_score, final_max, skill_breakdown)").eq("token_hash", hashToken(token)).maybeSingle()
  if (q.error || !q.data) return nope
  const row = q.data as unknown as Row
  const sub = Array.isArray(row.submissions) ? row.submissions[0] : row.submissions
  // Only after the hiring team has closed the application, and only when there are real scores to show.
  if (!row.candidates || row.candidates.stage !== "rejected" || !sub || sub.scoring_status !== "scored" || !sub.skill_breakdown?.length) return nope
  const pct = sub.final_score !== null && sub.final_max ? Math.round((Number(sub.final_score) / Number(sub.final_max)) * 100) : null
  const r = growthReport(pct, sub.skill_breakdown)
  const first = row.candidates.full_name.split(" ")[0]

  return (
    <PortalShell>
      <h1 className="t-large text-ink">{first}, here is your report</h1>
      <p className="t-body mt-2 text-ink-2">For the {row.candidates.jobs?.title ?? "role"} application. Only you can see this. It is not compared with anyone else, and it is a snapshot of one test, not a verdict on you.</p>

      {r.overallPct !== null ? <p className="mt-8"><span className="t-large tabular text-ink">{r.overallPct}%</span> <span className="t-callout text-ink-2">overall on the test</span></p> : null}

      <h2 className="t-title mt-10 text-ink">Your skills</h2>
      <ul className="mt-4 flex flex-col gap-4">
        {r.all.map((s) => (
          <li key={s.skill}>
            <div className="mb-1.5 flex items-baseline justify-between gap-3"><span className="t-body text-ink">{s.skill}</span><span className="t-callout tabular text-ink-2">{s.percent}%</span></div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-fog" role="img" aria-label={`${s.skill}: ${s.percent} percent`}><div className="h-full rounded-full bg-ink" style={{ width: `${s.percent}%` }} /></div>
          </li>
        ))}
      </ul>

      {r.strong.length ? (<><h2 className="t-title mt-10 text-ink">What you did well</h2><p className="t-body mt-2 text-ink">{r.strong.map((s) => s.skill).join(", ")}. Put these first on your resume.</p></>) : null}

      {r.steps.length ? (
        <>
          <h2 className="t-title mt-10 text-ink">What to practise next</h2>
          <ul className="mt-3 flex flex-col gap-3">{r.steps.map((s) => <li key={s.skill} className="t-body text-ink"><span className="font-semibold">{s.skill}.</span> {s.tip}</li>)}</ul>
        </>
      ) : null}
      <p className="t-footnote mt-12 text-ink-3">Made by Rekrutly from your own test answers, with no AI judging you and no comparison with other candidates.</p>
    </PortalShell>
  )
}
