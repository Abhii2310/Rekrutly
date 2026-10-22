import Link from "next/link"
import { GettingStarted } from "@/components/guide/getting-started"
import { getGuideProgress } from "@/lib/db/queries/guide"
import { QueryError } from "@/components/frame/query-error"
import { Button } from "@/components/ui/button"
import { GroupedList, ListRow } from "@/components/ui/grouped-list"
import { PageBody, PageHeader } from "@/components/ui/page-header"
import { Section } from "@/components/ui/section"
import { Stat } from "@/components/ui/stat"
import { StatusPill } from "@/components/ui/status-pill"
import { SimulatedTag } from "@/components/ui/tags"
import { EmptyState } from "@/components/ui/empty-state"
import { listJobs } from "@/lib/db/queries/jobs"
import { getOverviewStats, listActiveRuns, listOpenTasks, listRecentEvents } from "@/lib/db/queries/overview"
import { formatPercent, formatRelative } from "@/lib/format"
import { plural } from "@/lib/format-text"
import type { EventActor } from "@/lib/db/types"

export const dynamic = "force-dynamic"

const ACTOR: Record<EventActor, string> = { recruiter: "You", agent: "Rekrutly", system: "System", candidate: "Candidate" }

export default async function OverviewPage() {
  const [stats, jobs, tasks, runs, events, guide] = await Promise.all([
    getOverviewStats(), listJobs(), listOpenTasks(), listActiveRuns(), listRecentEvents(8), getGuideProgress(),
  ])
  if (!stats.ok || !jobs.ok || !tasks.ok || !runs.ok || !events.ok) {
    return (
      <>
        <PageHeader title="Overview" />
        <PageBody><QueryError message="Couldn't load your overview." /></PageBody>
      </>
    )
  }

  const openRoles = jobs.data.filter((j) => j.status === "open").length
  const now = new Date()

  return (
    <>
      <PageHeader
        title="Overview"
        description={`${plural(openRoles, "open role")}, ${plural(stats.data.totalCandidates, "candidate")}`}
        actions={<Button asChild><Link href="/command">New task</Link></Button>}
      />
      <PageBody>
        {guide.ok ? <div className="mb-10"><GettingStarted progress={guide.data} /></div> : null}
        <div className="grid grid-cols-2 gap-x-6 gap-y-8 md:grid-cols-4">
          <Stat value={stats.data.totalCandidates} label="Candidates" />
          <Stat value={stats.data.inAssessment} label="In assessment" />
          <Stat
            value={stats.data.completionRate === null ? <span className="t-headline flex h-11 items-center text-ink-2">No assessments yet</span> : formatPercent(stats.data.completionRate)}
            label="Completion rate"
          />
          <Stat value={stats.data.openTasks} label="Need you" />
        </div>

        <Section title="Needs your attention" className="mt-12">
          {tasks.data.length === 0 ? (
            <p className="t-body py-4 text-ink-2">Nothing needs you right now.</p>
          ) : (
            <GroupedList>
              {tasks.data.map((t) => (
                <ListRow
                  key={t.id}
                  title={t.title}
                  subtitle={t.detail ?? undefined}
                  pill={<StatusPill kind="task" value={t.status} />}
                  href={t.run_id ? `/runs/${t.run_id}/war-room` : t.candidate_id ? `/candidates?c=${t.candidate_id}` : undefined}
                />
              ))}
            </GroupedList>
          )}
        </Section>

        <Section title="Active workflows">
          {runs.data.length === 0 ? (
            <div className="rounded-group bg-mist">
              <EmptyState message="No workflows yet. Ask Rekrutly to start one." action={{ label: "New task", href: "/command", variant: "secondary" }} />
            </div>
          ) : (
            <GroupedList>
              {runs.data.map((r) => (
                <ListRow
                  key={r.id}
                  title={typeof r.plan.summary === "string" && r.plan.summary ? r.plan.summary : r.instruction}
                  value={formatRelative(r.created_at, now)}
                  pill={<StatusPill kind="run" value={r.status} />}
                  href={`/runs/${r.id}`}
                />
              ))}
            </GroupedList>
          )}
        </Section>

        <Section title="Recent activity">
          {events.data.length === 0 ? (
            <p className="t-body py-4 text-ink-2">Activity will appear here as Rekrutly works.</p>
          ) : (
            <GroupedList>
              {events.data.map((e) => (
                <ListRow
                  key={e.id}
                  title={<span className="t-body font-normal">{e.message}</span>}
                  subtitle={ACTOR[e.actor]}
                  value={formatRelative(e.created_at, now)}
                  pill={e.is_simulated ? <SimulatedTag /> : undefined}
                />
              ))}
            </GroupedList>
          )}
        </Section>
      </PageBody>
    </>
  )
}
