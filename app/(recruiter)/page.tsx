import { EmptyState } from "@/components/ui/empty-state"
import { PageBody, PageHeader } from "@/components/ui/page-header"

export default function OverviewPage() {
  return (
    <>
      <PageHeader title="Overview" description="Your roles, candidates and workflows at a glance." />
      <PageBody>
        <EmptyState message="Your overview will appear here once it's connected to your data." />
      </PageBody>
    </>
  )
}
