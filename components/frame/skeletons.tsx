import { PageBody, PageHeader } from "@/components/ui/page-header"
import { Skeleton } from "@/components/ui/skeleton"

/** Mist blocks at the size of the real rows (56px). */
export function ListSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="flex flex-col gap-2">
      {Array.from({ length: rows }, (_, i) => <Skeleton key={i} className="h-14 w-full" />)}
    </div>
  )
}

function SectionSkeleton({ rows }: { rows: number }) {
  return (
    <div className="mt-12 first:mt-0">
      <Skeleton className="mb-4 h-7 w-48" />
      <ListSkeleton rows={rows} />
    </div>
  )
}

export function OverviewSkeleton() {
  return (
    <>
      <PageHeader title="Overview" />
      <PageBody>
        <div className="grid grid-cols-2 gap-x-6 gap-y-8 md:grid-cols-4">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i}><Skeleton className="h-11 w-24" /><Skeleton className="mt-1 h-[18px] w-28" /></div>
          ))}
        </div>
        <div className="mt-12"><SectionSkeleton rows={2} /></div>
        <SectionSkeleton rows={1} />
        <SectionSkeleton rows={4} />
      </PageBody>
    </>
  )
}

export function ListPageSkeleton({ title, rows = 5, filters = false }: { title: string; rows?: number; filters?: boolean }) {
  return (
    <>
      <PageHeader title={title} />
      <PageBody>
        {filters ? (
          <div className="mb-6 flex flex-wrap gap-3">
            <Skeleton className="h-9 w-[420px] max-w-full" /><Skeleton className="h-9 w-28 rounded-full" /><Skeleton className="h-11 w-[280px] max-w-full" />
          </div>
        ) : null}
        <ListSkeleton rows={rows} />
      </PageBody>
    </>
  )
}

export function JobSkeleton() {
  return (
    <>
      <PageHeader title="Job" />
      <PageBody>
        <div className="flex gap-2">{Array.from({ length: 5 }, (_, i) => <Skeleton key={i} className="h-[22px] w-20 rounded-full" />)}</div>
        <Skeleton className="mt-6 h-24 w-full max-w-[640px]" />
        <div className="mt-12"><SectionSkeleton rows={5} /></div>
      </PageBody>
    </>
  )
}
