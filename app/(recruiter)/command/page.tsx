import { EmptyState } from "@/components/ui/empty-state"
import { PageBody, PageHeader } from "@/components/ui/page-header"

export default function Page() {
  return (
    <>
      <PageHeader title="Command" description="Tell Rekrutly what to do." />
      <PageBody>
        <EmptyState message="The Command Centre is built next. You'll type an instruction and see a plan here." />
      </PageBody>
    </>
  )
}
