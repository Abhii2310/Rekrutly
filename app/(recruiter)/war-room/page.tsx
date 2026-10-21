import { EmptyState } from "@/components/ui/empty-state"
import { PageBody, PageHeader } from "@/components/ui/page-header"

export default function Page() {
  return (
    <>
      <PageHeader title="War Room" description="A live view of a running workflow." />
      <PageBody>
        <EmptyState message="The War Room will show a workflow once one is running." />
      </PageBody>
    </>
  )
}
