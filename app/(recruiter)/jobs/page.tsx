import { NewJobDialog } from "@/components/jobs/new-job-dialog"
import { QueryError } from "@/components/frame/query-error"
import { EmptyState } from "@/components/ui/empty-state"
import { GroupedList, ListRow } from "@/components/ui/grouped-list"
import { PageBody, PageHeader } from "@/components/ui/page-header"
import { DemoTag } from "@/components/ui/tags"
import { listJobs } from "@/lib/db/queries/jobs"
import { plural, stageSummary } from "@/lib/format-text"
import { CANDIDATE_STAGES } from "@/lib/status"

export const dynamic = "force-dynamic"

export default async function JobsPage() {
  const jobs = await listJobs()
  if (!jobs.ok) {
    return (
      <>
        <PageHeader title="Jobs" />
        <PageBody><QueryError message="Couldn't load jobs." /></PageBody>
      </>
    )
  }
  const hasDemo = jobs.data.some((j) => j.is_demo)

  return (
    <>
      <PageHeader title="Jobs" description="Open roles and their candidates." actions={<>{hasDemo ? <DemoTag /> : null}<NewJobDialog /></>} />
      <PageBody>
        {jobs.data.length === 0 ? (
          <EmptyState message="No roles yet. Create your first role to get started." />
        ) : (
          <GroupedList>
            {jobs.data.map((j) => (
              <ListRow
                key={j.id}
                href={`/jobs/${j.id}`}
                title={j.title}
                subtitle={[j.team, j.location].filter(Boolean).join(", ")}
                value={
                  <span className="flex flex-col items-end">
                    <span className="text-ink">{plural(j.candidate_count, "candidate")}</span>
                    <span className="t-footnote text-ink-2">{stageSummary(j.stage_counts, CANDIDATE_STAGES)}</span>
                  </span>
                }
              />
            ))}
          </GroupedList>
        )}
      </PageBody>
    </>
  )
}
