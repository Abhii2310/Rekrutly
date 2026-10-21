import { EmptyState } from "@/components/ui/empty-state"
import { PageBody, PageHeader } from "@/components/ui/page-header"

export default function Page() {
  return (
    <>
      <PageHeader title="Analytics" description="Numbers from your own data." />
      <PageBody>
        <EmptyState message="Analytics will appear once candidates complete assessments." />
      </PageBody>
    </>
  )
}
