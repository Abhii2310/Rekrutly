import { redirect } from "next/navigation"
import { QueryError } from "@/components/frame/query-error"
import { EmptyState } from "@/components/ui/empty-state"
import { PageBody, PageHeader } from "@/components/ui/page-header"
import { getDb } from "@/lib/db/server"

export const dynamic = "force-dynamic"

/** The War Room item in the sidebar opens the most recent assessment workflow that is past approval and not cancelled. */
export default async function Page() {
  const { data, error } = await getDb().from("workflow_runs").select("id")
    .eq("intent", "create_assessment_workflow")
    .in("status", ["approved", "executing", "waiting", "paused", "completed", "failed"])
    .order("created_at", { ascending: false }).limit(1)
  if (error) {
    return (
      <>
        <PageHeader title="War Room" />
        <PageBody><QueryError message="Couldn't load your workflows." /></PageBody>
      </>
    )
  }
  const run = (data as { id: string }[])[0]
  if (run) redirect(`/runs/${run.id}/war-room`)
  return (
    <>
      <PageHeader title="War Room" description="A live view of a running workflow." />
      <PageBody>
        <div className="rounded-group bg-mist">
          <EmptyState message="No workflow is running yet. Ask Rekrutly to create an assessment." action={{ label: "Open the Command Centre", href: "/command", variant: "secondary" }} />
        </div>
      </PageBody>
    </>
  )
}
