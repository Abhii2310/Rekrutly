import Link from "next/link"
import { Button } from "@/components/ui/button"

/** One sentence about what this area will show, and one primary button that creates it. */
export function EmptyState({ message, action }: { message: string; action?: { label: string; href: string; variant?: "primary" | "secondary" } }) {
  return (
    <div className="flex flex-col items-center gap-5 px-6 py-20 text-center">
      <p className="t-body max-w-[420px] text-ink-2">{message}</p>
      {action ? (
        <Button asChild variant={action.variant ?? "primary"}>
          <Link href={action.href}>{action.label}</Link>
        </Button>
      ) : null}
    </div>
  )
}
