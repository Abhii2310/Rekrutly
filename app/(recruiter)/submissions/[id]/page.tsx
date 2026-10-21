import Link from "next/link"
import { notFound } from "next/navigation"
import { QueryError } from "@/components/frame/query-error"
import { QuestionResults } from "@/components/results/question-results"
import { PrintButton, RetryScoring, SubmissionWatcher } from "@/components/results/submission-tools"
import { AIMark } from "@/components/ui/ai-mark"
import { Button } from "@/components/ui/button"
import { PageBody, PageHeader } from "@/components/ui/page-header"
import { Section } from "@/components/ui/section"
import { Skeleton } from "@/components/ui/skeleton"
import { Pill } from "@/components/ui/status-pill"
import { SimulatedTag } from "@/components/ui/tags"
import { Stat } from "@/components/ui/stat"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { getSubmissionDetail } from "@/lib/db/queries/submission"
import { formatDateTime } from "@/lib/format"
import { describeSignals } from "@/lib/scoring/labels"
import { toPercent } from "@/lib/scoring/aggregate"

export const dynamic = "force-dynamic"

function Bars({ skills }: { skills: { skill: string; score: number; max: number; percent: number }[] }) {
  return (
    <ul className="flex flex-col gap-4">
      {skills.map((s) => (
        <li key={s.skill}>
          <div className="mb-1.5 flex items-baseline justify-between gap-3">
            <span className="t-body text-ink">{s.skill}</span>
            <span className="t-callout tabular text-ink-2">{s.percent}%</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-fog" role="img" aria-label={`${s.skill}: ${s.percent} percent`}>
            <div className="h-full rounded-full bg-ink" style={{ width: `${s.percent}%` }} />
          </div>
        </li>
      ))}
    </ul>
  )
}

export default async function SubmissionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound()
  const res = await getSubmissionDetail(id)
  if (!res.ok) {
    return (
      <>
        <PageHeader title="Submission" />
        <PageBody><QueryError message="Couldn't load this submission." /></PageBody>
      </>
    )
  }
  if (!res.data) notFound()
  const d = res.data
  const scoringDone = d.scoringStatus === "scored"
  const scoringBusy = d.scoringStatus === "pending" || d.scoringStatus === "scoring"
  const reportBusy = !scoringBusy && (d.reportStatus === "pending" || d.reportStatus === "generating")
  const hasWritten = d.questions.some((q) => q.type === "short")
  const objPct = d.objective.score !== null && d.objective.max ? toPercent(d.objective.score, d.objective.max) : null
  const aiPct = d.ai.score !== null && d.ai.max ? toPercent(d.ai.score, d.ai.max) : null

  return (
    <>
      <PageHeader
        title={d.candidate.name}
        description={`${d.jobTitle}, submitted ${formatDateTime(d.submittedAt)}${d.autoSubmitted ? ", time ran out" : ""}`}
        actions={
          <>
            {d.isSimulated ? <SimulatedTag /> : null}
            <span data-print-hide><Button asChild variant="plain"><Link href={`/assessments/${d.assessment.id}/results`}>All results</Link></Button></span>
            <PrintButton />
          </>
        }
      />
      <PageBody>
        <SubmissionWatcher submissionId={d.id} busy={scoringBusy || reportBusy} />
        <div className="max-w-[760px]">
          <div className="grid grid-cols-1 gap-x-8 gap-y-6 sm:grid-cols-3">
            <Stat value={objPct === null ? "–" : `${objPct}%`} label={d.objective.max ? `Objective score, ${d.objective.score} of ${d.objective.max} points` : "Objective score"} />
            {hasWritten ? (
              scoringBusy ? (
                <div><Skeleton className="h-11 w-20" /><p className="t-callout mt-1 text-ink-2">Reviewing written answers…</p></div>
              ) : (
                <div>
                  <div className="t-stat text-ink">{aiPct === null ? "–" : `${aiPct}%`}</div>
                  <div className="mt-1"><AIMark label="Suggested AI score" /></div>
                </div>
              )
            ) : (
              <Stat value="–" label="No written questions" />
            )}
            <Stat value={`${d.answeredCount} of ${d.questions.length}`} label="Questions answered" />
          </div>

          {d.scoringStatus === "failed" ? (
            <div className="mt-8 rounded-group bg-mist">
              <RetryScoring submissionId={d.id} message="Couldn't review the written answers." hint={`${d.scoringError ?? "The AI could not be reached."} The multiple-choice score above is saved.`} />
            </div>
          ) : null}

          {scoringDone && d.skillBreakdown.length > 0 ? (
            <Section title="Skills" className="mt-12"><Bars skills={d.skillBreakdown} /></Section>
          ) : scoringBusy ? (
            <Section title="Skills" className="mt-12"><div className="flex flex-col gap-4">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-8 w-full" />)}</div></Section>
          ) : null}

          <Section title="Questions" className="mt-12">
            <QuestionResults questions={d.questions} scoringDone={scoringDone} />
          </Section>

          <Section title="Report" className="mt-12" action={d.report ? <AIMark /> : undefined}>
            {d.report ? (
              <div className="flex flex-col gap-8">
                <p className="t-body text-ink">{d.report.summary}</p>
                {d.report.strengths.length > 0 ? (
                  <div>
                    <h3 className="t-headline mb-3 text-ink">Strengths</h3>
                    <ul className="flex flex-col gap-3">{d.report.strengths.map((s) => (
                      <li key={`${s.skill}-${s.evidence}`}><p className="t-body font-medium text-ink">{s.skill}</p><p className="t-callout text-ink-2">{s.evidence}</p></li>
                    ))}</ul>
                  </div>
                ) : null}
                {d.report.gaps.length > 0 ? (
                  <div>
                    <h3 className="t-headline mb-3 text-ink">Gaps</h3>
                    <ul className="flex flex-col gap-3">{d.report.gaps.map((s) => (
                      <li key={`${s.skill}-${s.evidence}`}><p className="t-body font-medium text-ink">{s.skill}</p><p className="t-callout text-ink-2">{s.evidence}</p></li>
                    ))}</ul>
                  </div>
                ) : null}
                <div>
                  <h3 className="t-headline mb-3 text-ink">Suggested interview questions</h3>
                  <ol className="flex flex-col gap-5">{d.report.interview_questions.map((q, i) => (
                    <li key={i}>
                      <div className="mb-1"><Pill>{q.skill}</Pill></div>
                      <p className="t-body text-ink">{q.question}</p>
                      <p className="t-callout mt-1 text-ink-2">What good looks like: {q.what_good_looks_like}</p>
                    </li>
                  ))}</ol>
                </div>
                {d.report.missing_evidence.length > 0 ? (
                  <div>
                    <h3 className="t-headline mb-3 text-ink">Missing evidence</h3>
                    <ul className="t-callout flex list-disc flex-col gap-1 pl-5 text-ink-2">{d.report.missing_evidence.map((m) => <li key={m}>{m}</li>)}</ul>
                  </div>
                ) : null}
              </div>
            ) : d.reportStatus === "failed" ? (
              <div className="rounded-group bg-mist"><RetryScoring submissionId={d.id} message="Couldn't write the report." hint={d.reportError ?? undefined} /></div>
            ) : scoringBusy || reportBusy ? (
              <div role="status">
                <p className="t-callout mb-3 text-ink-2">{scoringBusy ? "Reviewing written answers…" : "Writing the report…"}</p>
                <div className="flex flex-col gap-3"><Skeleton className="h-6 w-full" /><Skeleton className="h-6 w-5/6" /><Skeleton className="h-6 w-2/3" /></div>
              </div>
            ) : null}
          </Section>

          <p className="t-callout mt-12 text-ink-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <button type="button" className="focus-ring rounded underline decoration-hairline underline-offset-4">Signals (not proof)</button>
              </TooltipTrigger>
              <TooltipContent>Switching tabs or pasting can happen for ordinary reasons, like looking up a note. They are shown so you can ask, not so you can decide.</TooltipContent>
            </Tooltip>
            : {describeSignals(d.signals)}
          </p>
        </div>
      </PageBody>
    </>
  )
}
