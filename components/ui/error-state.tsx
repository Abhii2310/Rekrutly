"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"

/** What happened, what to do, Retry. No apologies. */
export function ErrorState({ message, hint, onRetry, action }: { message: string; hint?: string; onRetry?: () => void; action?: { label: string; href: string } }) {
  return (
    <div role="alert" className="flex flex-col items-center gap-4 px-6 py-20 text-center">
      <div className="max-w-[460px]">
        <p className="t-headline text-ink">{message}</p>
        {hint ? <p className="t-callout mt-1 text-ink-2">{hint}</p> : null}
      </div>
      {onRetry ? (
        <Button variant="secondary" onClick={onRetry}>
          Retry
        </Button>
      ) : null}
      {action ? (
        <Button asChild variant="secondary">
          <Link href={action.href}>{action.label}</Link>
        </Button>
      ) : null}
    </div>
  )
}
