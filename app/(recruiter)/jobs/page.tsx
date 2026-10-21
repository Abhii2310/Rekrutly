import { EmptyState } from "@/components/ui/empty-state"
import { PageBody, PageHeader } from "@/components/ui/page-header"

export default function Page() {
  return (
    <>
      <PageHeader title="Jobs" description="Open roles and their candidates." />
      <PageBody>
        <EmptyState message="Open roles will appear here." />
      </PageBody>
    </>
  )
}
