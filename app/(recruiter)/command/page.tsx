import 'server-only';
import { CommandCentre } from "@/components/command/command-centre"
import { PageHeader } from "@/components/ui/page-header"
import { QueryError } from "@/components/frame/query-error"
import { listJobs } from "@/lib/db/queries/jobs"
import { env } from "@/lib/env"

export const dynamic = "force-dynamic"

export default async function CommandPage({ searchParams }: { searchParams: Promise<{ job?: string; q?: string }> }) {
  const { job, q } = await searchParams
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
  const text = (q ?? "").slice(0, 2000)
  return <CommandCentre key={text} jobs={open} defaultJobId={defaultJobId} demoMode={env.DEMO_MODE} initialText={text} autoPlan={text.trim().length >= 3} />
}
