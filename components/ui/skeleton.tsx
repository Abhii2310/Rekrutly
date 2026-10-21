import { cn } from "cn"

/** A mist block at the exact size of the content it replaces. No shimmer. */
function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="skeleton" aria-hidden className={cn("rounded-control bg-mist", className)} {...props} />
}

export { Skeleton }
