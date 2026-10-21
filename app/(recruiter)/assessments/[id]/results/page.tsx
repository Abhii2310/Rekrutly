import Link from "next/link"
import { notFound } from "next/navigation"
import { QueryError } from "@/components/frame/query-error"
import { ResultsLive } from "@/components/results/results-live"
import { Button } from "@/components/ui/button"
import { PageBody, PageHeader } from "@/components/ui/page-header"
import { getAssessmentResults } from "@/lib/db/queries/results"
import { plural } from "@/lib/format-text"

export const dynamic = "force-dynamic"

export default async function ResultsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound()
  const res = await getAssessmentResults(id)
  if (!res.ok) {
    return (
      <>
        <PageHeader title="Results" />
        <PageBody><QueryError message="Couldn't load the results." /></PageBody>
      </>
    )
  }
  if (!res.data) notFound()
  const { assessment, counts } = res.data
  return (
    <>
      <PageHeader
        title={assessment.title}
        description={`${plural(counts.invited, "candidate")} invited, ${counts.submitted} submitted`}
        actions={assessment.runId ? <Button asChild variant="secondary"><Link href={`/runs/${assessment.runId}`}>Back to workflow</Link></Button> : undefined}
      />
      <PageBody>
        <ResultsLive assessmentId={assessment.id} initial={res.data} />
      </PageBody>
    </>
  )
}
