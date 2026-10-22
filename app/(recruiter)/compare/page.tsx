import Link from "next/link"
import { AIMark } from "@/components/ui/ai-mark"
import { Button } from "@/components/ui/button"
import { ErrorState } from "@/components/ui/error-state"
import { PageBody, PageHeader } from "@/components/ui/page-header"
import { SimulatedTag } from "@/components/ui/tags"
import { parseCompareIds, truncate } from "@/lib/analytics/compare"
import { formatMinutes } from "@/lib/analytics/stats"
import { getComparison, type CompareCandidate } from "@/lib/db/queries/compare"
import { getDossier } from "@/lib/hr/dossier"
import { SCORECARD_AREAS } from "@/lib/hr/types"

export const dynamic = "force-dynamic"

const pct = (n: number | null): string => (n === null ? "–" : `${n}%`)

function Quote({ text }: { text: string }) {
  const short = truncate(text, 140)
  if (short === text) return <p className="t-callout text-ink">&ldquo;{text}&rdquo;</p>
  return (
    <details className="t-callout text-ink">
      <summary className="focus-ring cursor-pointer list-none rounded-md">
        &ldquo;{short}&rdquo; <span className="text-action">Show more</span>
      </summary>
      <p className="mt-1">&ldquo;{text}&rdquo;</p>
    </details>
  )
}

function SkillCell({ c, skill }: { c: CompareCandidate; skill: string }) {
  const s = c.skills[skill]
  if (!s) return <span className="t-callout text-ink-2">–</span>
  return (
    <div className="flex flex-col gap-1.5">
      <p className="t-body tabular text-ink">{s.score} of {s.max} points <span className="text-ink-2">({s.percent}%)</span></p>
      {s.mcq ? <p className="t-callout tabular text-ink-2">{s.mcq.correct} of {s.mcq.total} multiple choice correct</p> : null}
      {s.evidence ? (
        <>
          {s.evidence.quote ? <Quote text={s.evidence.quote} /> : <p className="t-callout text-ink-2">No quote could be matched to this answer. Open the submission to read it.</p>}
          <p className="t-footnote text-ink-2">Written answer, {s.evidence.score} of {s.evidence.max}</p>
        </>
      ) : <p className="t-callout text-ink-2">No written answer for this skill.</p>}
    </div>
  )
}

const rowLabel = "t-callout w-[170px] min-w-[170px] py-4 pr-4 text-left align-top font-normal text-ink-2"
const cell = "min-w-[210px] px-4 py-4 align-top"
const rule = "border-t border-hairline/70"

export default async function ComparePage({ searchParams }: { searchParams: Promise<{ s?: string }> }) {
  const { s } = await searchParams
  const ids = parseCompareIds(s)
  const res = ids.ok ? await getComparison(ids.data) : null
  const error = !ids.ok ? ids.error : res && !res.ok ? res.error : null

  if (error || !res || !res.ok) {
    return (
      <>
        <PageHeader title="Compare" />
        <PageBody>
          <ErrorState message={error?.message ?? "Couldn't compare these candidates."} hint={ids.ok || ids.error.code !== "no_selection" ? "Open a results page, tick two to four candidates and press Compare." : undefined} action={{ label: "Go to Jobs", href: "/jobs" }} />
        </PageBody>
      </>
    )
  }

  const { assessment, candidates, skills, jobTitle } = res.data
  // The rest of the hiring flow, if it is available: resume match, shortlist, interview ratings and camera flags.
  const dossiers = await Promise.all(candidates.map((c) => getDossier(c.candidateId)))
  const extra = dossiers.map((d) => (d.ok ? d.data : null))
  const hasExtra = extra.some((d) => d && (d.match || d.interviews.some((i) => i.scorecard) || d.proctoring || d.shortlisted))
  return (
    <>
      <PageHeader
        title="Compare candidates"
        description={`${jobTitle}, ${assessment.title}`}
        actions={<Button asChild variant="secondary"><Link href={`/assessments/${assessment.id}/results`}>Back to results</Link></Button>}
      />
      <PageBody>
        <div className="-mx-4 overflow-x-auto px-4 md:mx-0 md:px-0">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr>
                <th scope="col" className="w-[170px] min-w-[170px]"><span className="sr-only">Measure</span></th>
                {candidates.map((c) => (
                  <th key={c.submissionId} scope="col" className={`${cell} pb-3 pt-0 font-normal`}>
                    <Link href={`/submissions/${c.submissionId}`} className="focus-ring t-title block rounded-md text-ink hover:text-action">{c.name}</Link>
                    {c.isSimulated ? <span className="mt-1 inline-flex"><SimulatedTag /></span> : null}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr className={rule}>
                <th scope="row" className={rowLabel}>Final score</th>
                {candidates.map((c) => <td key={c.submissionId} className={`${cell} t-stat tabular text-ink`}>{pct(c.finalPct)}{c.finalPct === null ? <span className="t-callout block text-ink-2">{c.scoring === "failed" ? "Scoring failed" : "Scoring…"}</span> : null}</td>)}
              </tr>
              <tr className={rule}>
                <th scope="row" className={rowLabel}>Objective score</th>
                {candidates.map((c) => <td key={c.submissionId} className={`${cell} t-body tabular text-ink`}>{pct(c.objectivePct)}</td>)}
              </tr>
              <tr className={rule}>
                <th scope="row" className={rowLabel}><span className="flex flex-col items-start gap-1">Written answers<AIMark /></span></th>
                {candidates.map((c) => <td key={c.submissionId} className={`${cell} t-body tabular text-ink`}>{pct(c.aiPct)}</td>)}
              </tr>
              <tr className={rule}>
                <th scope="row" className={rowLabel}>Time taken</th>
                {candidates.map((c) => <td key={c.submissionId} className={`${cell} t-body tabular text-ink`}>{formatMinutes(c.minutes)}</td>)}
              </tr>
              <tr className={rule}>
                <th scope="row" className={rowLabel}>Questions answered</th>
                {candidates.map((c) => <td key={c.submissionId} className={`${cell} t-body tabular text-ink`}>{c.answered} of {c.total}</td>)}
              </tr>
              {hasExtra ? (
                <>
                  <tr className={rule}>
                    <th scope="row" className={rowLabel}><span className="flex flex-col items-start gap-1">Resume match<AIMark /></span></th>
                    {extra.map((d, i) => <td key={candidates[i]?.submissionId} className={`${cell} t-body tabular text-ink`}>{d?.match ? `${d.match.score}%` : "–"}{d?.shortlisted ? <span className="t-callout block text-ink-2">Shortlisted</span> : null}</td>)}
                  </tr>
                  <tr className={rule}>
                    <th scope="row" className={rowLabel}>Interview ratings</th>
                    {extra.map((d, i) => {
                      const card = d?.interviews.find((x) => x.scorecard)?.scorecard
                      return (
                        <td key={candidates[i]?.submissionId} className={cell}>
                          {card ? (
                            <ul className="t-callout flex flex-col gap-1 text-ink-2">{SCORECARD_AREAS.map((a) => card.ratings[a] ? <li key={a} className="flex justify-between gap-4"><span>{a}</span><span className="tabular text-ink">{card.ratings[a]} of 5</span></li> : null)}</ul>
                          ) : <span className="t-callout text-ink-2">No interview ratings yet.</span>}
                        </td>
                      )
                    })}
                  </tr>
                  <tr className={rule}>
                    <th scope="row" className={rowLabel}>Camera exam</th>
                    {extra.map((d, i) => <td key={candidates[i]?.submissionId} className={`${cell} t-callout text-ink`}>{d?.proctoring ? (d.proctoring.flagged === 0 ? "Nothing flagged" : `${d.proctoring.flagged} to review`) : <span className="text-ink-2">Not recorded</span>}</td>)}
                  </tr>
                </>
              ) : null}
              {skills.map((skill) => (
                <tr key={skill} className={rule}>
                  <th scope="row" className={rowLabel}>{skill}</th>
                  {candidates.map((c) => <td key={c.submissionId} className={cell}><SkillCell c={c} skill={skill} /></td>)}
                </tr>
              ))}
              <tr className={rule}>
                <th scope="row" className={rowLabel}><span className="flex flex-col items-start gap-1">Gaps to probe in interview<AIMark /></span></th>
                {candidates.map((c) => (
                  <td key={c.submissionId} className={cell}>
                    {c.probes.length === 0 ? <span className="t-callout text-ink-2">No report yet.</span> : (
                      <ul className="flex flex-col gap-3">
                        {c.probes.map((p) => (
                          <li key={p.question}>
                            <p className="t-footnote text-ink-2">{p.skill}</p>
                            <p className="t-callout text-ink">{p.question}</p>
                          </li>
                        ))}
                      </ul>
                    )}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
        <p className="t-callout mt-8 max-w-[640px] text-ink-2">Rekrutly doesn&apos;t pick a winner. Use the evidence and your judgement.</p>
      </PageBody>
    </>
  )
}
