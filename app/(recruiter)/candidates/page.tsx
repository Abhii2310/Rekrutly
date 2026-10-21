import { EmptyState } from "@/components/ui/empty-state"
import { PageBody, PageHeader } from "@/components/ui/page-header"

export default function Page() {
  return (
    <>
      <PageHeader title="Candidates" description="Everyone in your pipeline." />
      <PageBody>
        <EmptyState message="Candidates will appear here." />
      </PageBody>
    </>
  )
}
