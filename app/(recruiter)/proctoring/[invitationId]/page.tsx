import Link from "next/link"
import { notFound } from "next/navigation"
import { QueryError } from "@/components/frame/query-error"
import { ReviewPlayer } from "@/components/proctoring/review-player"
import { Button } from "@/components/ui/button"
import { PageBody, PageHeader } from "@/components/ui/page-header"
import { getProctorReview } from "@/lib/db/queries/proctoring"

export const dynamic = "force-dynamic"

export default async function ProctoringReviewPage({ params, searchParams }: { params: Promise<{ invitationId: string }>; searchParams: Promise<{ t?: string }> }) {
  const { invitationId } = await params
  const { t } = await searchParams
  if (!/^[0-9a-f-]{36}$/i.test(invitationId)) notFound()
  const res = await getProctorReview(invitationId)
  if (!res.ok) return <><PageHeader title="Recording" /><PageBody><QueryError message="Couldn't load this recording." /></PageBody></>
  if (!res.data || !res.data.proctored) notFound()
  const d = res.data
  const start = Number.isFinite(Number(t)) ? Math.max(0, Number(t) - 5) : 0
  return (
    <>
      <PageHeader
        title={d.candidate.name}
        description={`${d.assessmentTitle}. Camera recording, shown with the candidate's consent.`}
        actions={d.submissionId ? <Button asChild variant="secondary" size="sm"><Link href={`/submissions/${d.submissionId}`}>View submission</Link></Button> : undefined}
      />
      <PageBody>
        <ReviewPlayer segments={d.segments} flagged={d.flagged} startAtSeconds={start} />
      </PageBody>
    </>
  )
}
