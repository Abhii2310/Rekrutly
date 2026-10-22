import { BarList } from "@/components/analytics/bar-list"
import { Funnel } from "@/components/analytics/funnel"
import { JobFilter } from "@/components/analytics/job-filter"
import { QueryError } from "@/components/frame/query-error"
import { EmptyState } from "@/components/ui/empty-state"
import { PageBody, PageHeader } from "@/components/ui/page-header"
import { Section } from "@/components/ui/section"
import { Stat } from "@/components/ui/stat"
import { completionTakeaway, formatMinutes, funnelTakeaway, skillsTakeaway, speedTakeaway } from "@/lib/analytics/stats"
import { getAnalytics } from "@/lib/db/queries/analytics"
import { getHiringFunnel } from "@/lib/db/queries/funnel"
import { formatPercent } from "@/lib/format"
import { TASK_TYPE_LABELS } from "@/lib/status"

export const dynamic = "force-dynamic"

export default async function AnalyticsPage({ searchParams }: { searchParams: Promise<{ job?: string }> }) {
  const { job } = await searchParams
  const res = await getAnalytics(job && /^[0-9a-f-]{36}$/i.test(job) ? job : null)
  if (!res.ok) {
    return (
      <>
        <PageHeader title="Analytics" />
        <PageBody><QueryError message="Couldn't load the numbers." /></PageBody>
      </>
    )
  }
  const { analytics: a, jobs, selectedJobId } = res.data
  const funnel = await getHiringFunnel(selectedJobId)
  const empty = a.invited === 0 && a.totalCandidates === 0

  return (
    <>
      <PageHeader
        title="Analytics"
        description="Numbers from your own data."
        actions={<JobFilter jobs={jobs} selected={selectedJobId} />}
      />
      <PageBody>
        {empty ? (
          <div className="rounded-group bg-mist">
            <EmptyState message="Analytics will appear once candidates complete assessments. Ask Rekrutly to create one." action={{ label: "Open the Command Centre", href: "/command" }} />
          </div>
        ) : (
          <div className="max-w-[760px]">
            {a.includesDemo ? <p className="t-callout mb-8 text-ink-2">Includes demo and simulated data.</p> : null}

            <div className="grid grid-cols-2 gap-x-6 gap-y-8 md:grid-cols-4">
              <Stat value={a.invited} label="Invited" />
              <Stat value={a.completionRate === null ? "–" : formatPercent(a.completionRate)} label="Completion" />
              <Stat value={a.avgObjectivePct === null ? "–" : `${a.avgObjectivePct}%`} label="Average objective score" />
              <Stat value={<span className="whitespace-nowrap">{formatMinutes(a.medianMinutesToFinish)}</span>} label="Median time to finish" />
            </div>
            {completionTakeaway(a) ? <p className="t-body mt-6 text-ink">{completionTakeaway(a)}</p> : null}

            {funnel.ok && funnel.data.total > 0 ? (
              <Section title="Hiring funnel" className="mt-14">
                <p className="t-body mb-5 text-ink-2">How many people reached each step{selectedJobId ? " for this role" : ""}. These are counts of people, not a ranking.</p>
                <BarList ariaLabel="People at each step of the hiring flow" items={funnel.data.steps.map((s) => ({ label: s.label, value: s.count }))} />
              </Section>
            ) : null}

            <Section title="Pipeline" className="mt-14">
              {funnelTakeaway(a) ? <p className="t-body mb-5 text-ink-2">{funnelTakeaway(a)}</p> : <p className="t-body text-ink-2">No candidates yet.</p>}
              {a.totalCandidates > 0 ? <Funnel stages={a.stages} /> : null}
            </Section>

            <Section title="Skills">
              {skillsTakeaway(a.skills) ? (
                <>
                  <p className="t-body mb-5 text-ink-2">{skillsTakeaway(a.skills)}</p>
                  <BarList
                    ariaLabel="Average score by skill" max={100}
                    items={a.skills.map((s) => ({ label: s.skill, value: s.avgPct, display: `${s.avgPct}%`, note: `${s.submissions} ${s.submissions === 1 ? "submission" : "submissions"}` }))}
                  />
                </>
              ) : <p className="t-body text-ink-2">Skill scores appear once a submission is scored.</p>}
            </Section>

            <Section title="Speed">
              {speedTakeaway(a).length > 0 ? (
                <div className="flex flex-col gap-1">{speedTakeaway(a).map((s) => <p key={s} className="t-body text-ink">{s}</p>)}</div>
              ) : <p className="t-body text-ink-2">Timings appear once candidates start and finish.</p>}
            </Section>

            <Section title="Open work">
              {a.tasksByType.length === 0 ? (
                <p className="t-body text-ink-2">Nothing is waiting for you.</p>
              ) : (
                <BarList ariaLabel="Open tasks by type" items={a.tasksByType.map((t) => ({ label: TASK_TYPE_LABELS[t.type], value: t.count }))} />
              )}
            </Section>
          </div>
        )}
      </PageBody>
    </>
  )
}
