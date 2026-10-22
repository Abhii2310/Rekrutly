import { notFound } from "next/navigation"
import { QueryError } from "@/components/frame/query-error"
import { PageBody, PageHeader } from "@/components/ui/page-header"
import { DemoTag } from "@/components/ui/tags"
import { WarRoom } from "@/components/war-room/war-room"
import { env, fromAddress } from "@/lib/env"
import { getRunLive } from "@/lib/db/queries/live"
import { getRunWithSteps } from "@/lib/db/queries/runs"

export const dynamic = "force-dynamic"

export default async function WarRoomPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound()
  const [res, live] = await Promise.all([getRunWithSteps(id), getRunLive(id)])
  if (!res.ok || !live.ok) {
    return (
      <>
        <PageHeader title="War Room" />
        <PageBody><QueryError message="Couldn't load this workflow." /></PageBody>
      </>
    )
  }
  if (!res.data || !live.data) notFound()
  const { run } = res.data
  return (
    <>
      <PageHeader
        title={run.plan.job ? `War Room: ${run.plan.job.title}` : "War Room"}
        description="Everything about this workflow, live."
        actions={run.is_demo ? <DemoTag /> : undefined}
      />
      <PageBody><WarRoom runId={run.id} initial={live.data} sender={/<([^>]+)>/.exec(fromAddress(env))?.[1] ?? null} /></PageBody>
    </>
  )
}
