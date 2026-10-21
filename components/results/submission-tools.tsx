"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { ErrorState } from "@/components/ui/error-state"
import { toast } from "@/components/ui/toaster"

/** Marks the submission as opened (candidate moves to "In review") once, and keeps the page fresh while scoring runs. */
export function SubmissionWatcher({ submissionId, busy }: { submissionId: string; busy: boolean }) {
  const router = useRouter()
  const marked = React.useRef(false)
  React.useEffect(() => {
    if (marked.current) return
    marked.current = true
    void fetch(`/api/submissions/${submissionId}/opened`, { method: "POST" }).catch(() => undefined)
  }, [submissionId])
  React.useEffect(() => {
    if (!busy) return
    const t = setInterval(() => router.refresh(), 3000)
    return () => clearInterval(t)
  }, [busy, router])
  return null
}

export function RetryScoring({ submissionId, message, hint }: { submissionId: string; message: string; hint?: string }) {
  const router = useRouter()
  async function retry() {
    try {
      const res = await fetch(`/api/submissions/${submissionId}/rescore`, { method: "POST" })
      if (!res.ok) toast("Couldn't start the retry. Try again.")
    } catch {
      toast("Couldn't reach the server. Check your connection and retry.")
    }
    router.refresh()
  }
  return <ErrorState message={message} hint={hint} onRetry={() => void retry()} />
}

export function PrintButton() {
  return <Button variant="secondary" data-print-hide onClick={() => window.print()}>Save as PDF</Button>
}
