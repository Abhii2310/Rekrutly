import Link from "next/link"
import { notFound } from "next/navigation"
import { QueryError } from "@/components/frame/query-error"
import { Avatar } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { GroupedList, ListRow } from "@/components/ui/grouped-list"
import { PageBody, PageHeader } from "@/components/ui/page-header"
import { Section } from "@/components/ui/section"
import { Pill, StatusPill } from "@/components/ui/status-pill"
import { listCandidates } from "@/lib/db/queries/candidates"
import { getJob } from "@/lib/db/queries/jobs"
import { listRunsForJob } from "@/lib/db/queries/overview"
import { formatRelative } from "@/lib/format"

export const dynamic = "force-dynamic"

export default async function JobPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound()
  const [job, candidates, runs] = await Promise.all([getJob(id), listCandidates({ jobId: id }), listRunsForJob(id)])
  if (!job.ok || !candidates.ok || !runs.ok) {
    return (
      <>
        <PageHeader title="Job" />
        <PageBody><QueryError message="Couldn't load this job." /></PageBody>
      </>
    )
  }
  if (!job.data) notFound()
  const j = job.data
  const now = new Date()

  return (
    <>
      <PageHeader
        title={j.title}
        description={[j.team, j.location].filter(Boolean).join(", ")}
        actions={<Button asChild><Link href={`/command?job=${j.id}`}>Create assessment</Link></Button>}
      />
      <PageBody>
        <div className="flex flex-wrap gap-2">
          {j.skills.map((s) => <Pill key={s}>{s}</Pill>)}
        </div>
        {j.description ? <p className="t-body mt-6 max-w-[640px] text-ink">{j.description}</p> : null}

        <Section title="Candidates" className="mt-12">
          <GroupedList>
            {candidates.data.map((c) => (
              <ListRow
                key={c.id}
                leading={<Avatar name={c.full_name} />}
                href={`/candidates?c=${c.id}`}
                title={c.full_name}
                subtitle={c.current_title && c.current_company ? `${c.current_title} at ${c.current_company}` : undefined}
                pill={<StatusPill kind="candidate" value={c.stage} />}
              />
            ))}
          </GroupedList>
        </Section>

        <Section title="Workflows for this job">
          {runs.data.length === 0 ? (
            <p className="t-body py-4 text-ink-2">No workflows for this role yet.</p>
          ) : (
            <GroupedList>
              {runs.data.map((r) => (
                <ListRow
                  key={r.id}
                  href={`/runs/${r.id}`}
                  title={typeof r.plan.summary === "string" && r.plan.summary ? r.plan.summary : r.instruction}
                  value={formatRelative(r.created_at, now)}
                  pill={<StatusPill kind="run" value={r.status} />}
                />
              ))}
            </GroupedList>
          )}
        </Section>
      </PageBody>
    </>
  )
}
