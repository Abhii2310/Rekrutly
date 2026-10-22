import { HiringBoard } from "@/components/board/hiring-board"
import { BoardJobFilter } from "@/components/board/job-filter"
import { QueryError } from "@/components/frame/query-error"
import { PageBody, PageHeader } from "@/components/ui/page-header"
import { listCandidates } from "@/lib/db/queries/candidates"
import { listJobs } from "@/lib/db/queries/jobs"
import { listHrBadges } from "@/lib/hr/queries"

export const dynamic = "force-dynamic"
const UUID = /^[0-9a-f-]{36}$/i

export default async function BoardPage({ searchParams }: { searchParams: Promise<{ job?: string }> }) {
  const { job } = await searchParams
  const jobId = job && UUID.test(job) ? job : ""
  const [list, jobs] = await Promise.all([listCandidates({ jobId: jobId || undefined }), listJobs()])
  if (!list.ok || !jobs.ok) return <><PageHeader title="Board" /><PageBody><QueryError message="Couldn't load the board." /></PageBody></>
  const badges = await listHrBadges(list.data.map((c) => c.id))
  const cards = list.data.map((c) => ({
    id: c.id, name: c.full_name, jobTitle: c.job_title, stage: c.stage,
    subtitle: c.current_title && c.current_company ? `${c.current_title} at ${c.current_company}` : c.current_title,
    match: badges.get(c.id)?.score ?? null, shortlisted: badges.get(c.id)?.shortlisted ?? false, interview: badges.get(c.id)?.interview ?? false, offer: badges.get(c.id)?.offer ?? false,
  }))
  return (
    <>
      <PageHeader title="Board" description="Everyone in the pipeline, by stage." actions={<BoardJobFilter jobs={jobs.data.filter((j) => j.status === "open").map((j) => ({ id: j.id, title: j.title }))} jobId={jobId} />} />
      <PageBody className="max-w-none"><HiringBoard cards={cards} showRole={!jobId} /></PageBody>
    </>
  )
}
