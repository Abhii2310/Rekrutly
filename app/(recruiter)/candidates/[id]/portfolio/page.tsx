import Link from "next/link"
import { notFound } from "next/navigation"
import { QueryError } from "@/components/frame/query-error"
import { PrintButton } from "@/components/results/submission-tools"
import { JudgmentPanel } from "@/components/hr/judgment-panel"
import { AiInterviewPanel } from "@/components/hr/ai-interview-panel"
import { AIMark } from "@/components/ui/ai-mark"
import { Button } from "@/components/ui/button"
import { PageBody, PageHeader } from "@/components/ui/page-header"
import { Section } from "@/components/ui/section"
import { Pill, StatusPill } from "@/components/ui/status-pill"
import { getDossier } from "@/lib/hr/dossier"
import { SCORECARD_AREAS } from "@/lib/hr/types"
import { formatDate } from "@/lib/format"
import { whenLabel } from "@/lib/interviews/rules"

export const dynamic = "force-dynamic"

function Bar({ label, percent }: { label: string; percent: number }) {
  return (
    <li>
      <div className="mb-1.5 flex items-baseline justify-between gap-3"><span className="t-body text-ink">{label}</span><span className="t-callout tabular text-ink-2">{percent}%</span></div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-fog" role="img" aria-label={`${label}: ${percent} percent`}><div className="h-full rounded-full bg-ink" style={{ width: `${percent}%` }} /></div>
    </li>
  )
}

/**
 * One page that shows how a person came across at every step: resume match, assessment, camera exam, interviews, offer.
 * It only shows what was recorded. It never ranks people or recommends a decision.
 */
export default async function PortfolioPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound()
  const res = await getDossier(id)
  if (!res.ok) return <><PageHeader title="Portfolio" /><PageBody><QueryError message="Couldn't load this portfolio." /></PageBody></>
  if (!res.data) notFound()
  const d = res.data
  const assessment = d.assessments[0]
  const interview = d.interviews.find((i) => i.scorecard)
  const sent = d.offers.find((o) => o.status === "sent")

  return (
    <>
      <PageHeader
        title={d.name}
        description={[d.role, d.jobTitle ? `Applying for ${d.jobTitle}` : null].filter(Boolean).join(". ")}
        actions={<><PrintButton /><Button asChild variant="secondary" size="sm"><Link href={`/candidates?c=${d.id}`}>Back to profile</Link></Button></>}
      />
      <PageBody className="max-w-[860px]">
        <div className="flex flex-wrap items-center gap-2"><StatusPill kind="candidate" value={d.stage} />{d.shortlisted ? <Pill>Shortlisted</Pill> : null}{d.location ? <span className="t-callout text-ink-2">{d.location}</span> : null}{d.yearsExperience !== null ? <span className="t-callout text-ink-2">{d.yearsExperience} years of experience</span> : null}</div>

        <div className="mt-8 grid grid-cols-2 gap-x-6 gap-y-8 md:grid-cols-4">
          {[
            ["Resume match", d.match ? `${d.match.score}%` : "Not checked", d.match && d.match.relevance !== null ? "Suggested by AI" : null],
            ["Assessment", assessment?.finalPct != null ? `${assessment.finalPct}%` : assessment ? "Scoring" : "Not taken", null],
            ["Camera exam", d.proctoring ? (d.proctoring.flagged === 0 ? "Nothing flagged" : `${d.proctoring.flagged} to review`) : "Not recorded", null],
            ["Interview", interview?.scorecard ? "Scorecard saved" : d.interviews.length ? "Booked" : "Not yet", interview ? "Ratings below" : null],
          ].map(([label, value, note]) => (
            <div key={label as string}><p className="t-callout text-ink-2">{label}</p><p className="t-title tabular mt-0.5 text-ink">{value}</p>{note ? <p className="t-footnote text-ink-3">{note}</p> : null}</div>
          ))}
        </div>

        {d.match ? (
          <Section title="Resume">
            <div className="flex items-start justify-between gap-4"><p className="t-body text-ink">{d.match.summary}</p>{d.match.relevance !== null ? <AIMark /> : null}</div>
            <div className="mt-3 flex flex-wrap gap-2">
              {d.match.coverage.matched.map((s) => <span key={s} className="t-footnote rounded-full bg-success-tint px-2.5 py-1 text-success">{s}</span>)}
              {d.match.coverage.missing.map((s) => <span key={s} className="t-footnote rounded-full bg-fog px-2.5 py-1 text-ink-2">{s}: not shown</span>)}
            </div>
            {d.match.strengths.length ? <ul className="mt-4 flex flex-col gap-2">{d.match.strengths.map((s) => <li key={s.quote}><p className="t-callout text-ink">{s.point}</p><p className="t-footnote text-ink-2">&ldquo;{s.quote}&rdquo;</p></li>)}</ul> : null}
          </Section>
        ) : null}

        {assessment ? (
          <Section title="Assessment">
            {assessment.summary ? <div className="flex items-start justify-between gap-4"><p className="t-body text-ink">{assessment.summary}</p><AIMark /></div> : null}
            {assessment.skills.length ? <ul className="mt-5 flex flex-col gap-4">{assessment.skills.map((s) => <Bar key={s.skill} label={s.skill} percent={s.percent} />)}</ul> : null}
            {assessment.submissionId ? <p className="mt-4"><Link href={`/submissions/${assessment.submissionId}`} className="focus-ring t-callout rounded text-action hover:text-action-hover">Open the full evidence</Link></p> : null}
          </Section>
        ) : null}

        {d.proctoring ? (
          <Section title="Camera exam">
            <p className="t-body text-ink-2">Signals, not proof. People look away and lose connections for ordinary reasons.</p>
            {d.proctoring.kinds.length ? <ul className="mt-3 flex flex-wrap gap-2">{d.proctoring.kinds.map((k) => <li key={k.label} className="t-footnote rounded-full bg-fog px-2.5 py-1 text-ink">{k.label}: {k.count}</li>)}</ul> : <p className="t-body mt-2 text-ink">Nothing was flagged.</p>}
            <p className="mt-3"><Link href={`/proctoring/${d.proctoring.invitationId}`} className="focus-ring t-callout rounded text-action hover:text-action-hover">Watch the recording</Link></p>
          </Section>
        ) : null}

        {d.aiTask ? (
          <Section title="Judgment with AI"><JudgmentPanel task={d.aiTask} /></Section>
        ) : null}

        {d.aiInterview ? (
          <Section title="AI interview"><AiInterviewPanel ai={d.aiInterview} /></Section>
        ) : null}

        {d.interviews.length ? (
          <Section title="Interviews">
            <ul className="flex flex-col gap-6">
              {d.interviews.map((i) => (
                <li key={i.id}>
                  <p className="t-headline text-ink">{whenLabel(new Date(i.scheduledAt))} <span className="t-callout font-normal text-ink-2">({i.status === "scheduled" ? "booked" : i.status})</span></p>
                  {i.scorecard ? (
                    <>
                      <ul className="mt-3 flex flex-col gap-3">{SCORECARD_AREAS.map((a) => i.scorecard?.ratings[a] ? <Bar key={a} label={a} percent={(i.scorecard.ratings[a] / 5) * 100} /> : null)}</ul>
                      {i.scorecard.summary ? <p className="t-body mt-3 text-ink">{i.scorecard.summary}</p> : null}
                    </>
                  ) : null}
                  {i.notes ? <p className="t-callout mt-3 whitespace-pre-wrap text-ink-2">{i.notes}</p> : null}
                  <p className="mt-2"><Link href={`/interviews/${i.id}`} className="focus-ring t-callout rounded text-action hover:text-action-hover">Open the interview</Link></p>
                </li>
              ))}
            </ul>
          </Section>
        ) : null}

        {d.offers.length ? (
          <Section title="Offer">
            <p className="t-body text-ink">{sent ? `Offer letter sent ${sent.sentAt ? formatDate(sent.sentAt) : ""}.` : "An offer letter is drafted and not sent."}</p>
            <p className="mt-2"><Link href={`/offers/${(sent ?? d.offers[0])?.id}`} className="focus-ring t-callout rounded text-action hover:text-action-hover">View the letter</Link></p>
          </Section>
        ) : null}

        <p className="t-footnote mt-12 text-ink-3">This page only shows what was recorded in Rekrutly. It does not rank people or recommend a decision. Every decision is made by a person.</p>
      </PageBody>
    </>
  )
}
