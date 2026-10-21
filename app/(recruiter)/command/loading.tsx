import { Skeleton } from "@/components/ui/skeleton"

export default function Loading() {
  return (
    <div className="mx-auto w-full max-w-[720px] px-4 pt-12 md:px-6">
      <Skeleton className="mx-auto h-12 w-3/4" />
      <Skeleton className="mt-8 h-[72px] w-full rounded-[18px]" />
      <Skeleton className="mt-3 h-9 w-48" />
    </div>
  )
}
