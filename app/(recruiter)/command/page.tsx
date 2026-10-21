import { CommandCentre } from "@/components/command/command-centre"
import { PageHeader } from "@/components/ui/page-header"
import { QueryError } from "@/components/frame/query-error"
import { listJobs } from "@/lib/db/queries/jobs"

export const dynamic = "force-dynamic"

export default async function CommandPage({ searchParams }: { searchParams: Promise<{ job?: string }> }) {
  const { job } = await searchParams
  const jobs = await listJobs()
  if (!jobs.ok) {
    return (
      <>
        <PageHeader title="Command" />
        <QueryError message="Couldn't load your jobs." />
      </>
    )
  }
  const open = jobs.data.filter((j) => j.status === "open").map((j) => ({ id: j.id, title: j.title }))
  // `?job=` wins, otherwise the most recently created open job.
  const defaultJobId = open.find((j) => j.id === job)?.id ?? open[0]?.id ?? null
  return <CommandCentre jobs={open} defaultJobId={defaultJobId} />
}
