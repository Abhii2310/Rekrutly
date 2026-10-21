"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { GroupedList, ListRow } from "@/components/ui/grouped-list"
import { ProgressRail, type RailStep } from "@/components/ui/progress-rail"
import { Section } from "@/components/ui/section"
import { toast } from "@/components/ui/toaster"
import { usePoll } from "@/hooks/use-poll"
import { formatTime } from "@/lib/format"
import type { RunLive } from "@/lib/db/queries/live"

type Preview = { targetRunId: string | null; targetTitle: string | null; recipients: { id: string; name: string; hasEmail: boolean }[] }

async function post(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: "{}" })
    if (res.ok) return null
    const json = (await res.json().catch(() => null)) as { error?: { message?: string } } | null
    return json?.error?.message ?? "Something went wrong. Try again."
  } catch {
    return "Couldn't reach the server. Check your connection and retry."
  }
}

/** Single column: the plan, who gets drafts, the steps, and one approval. Nothing here ever sends a message. */
export function SweepRun({ runId, initial, beforeApproval, cancelled, preview, targetRunId }: { runId: string; targetRunId: string | null; initial: RunLive; beforeApproval: boolean; cancelled: boolean; preview: Preview }) {
  const router = useRouter()
  const { data: live = initial } = usePoll<RunLive>(`/api/runs/${runId}/live`, { initial, enabled: !beforeApproval && !cancelled })
  const [approving, setApproving] = React.useState(false)
  const [cancelOpen, setCancelOpen] = React.useState(false)
  const [cancelling, setCancelling] = React.useState(false)
  const lastStatus = React.useRef(initial.run.status)
  React.useEffect(() => {
    if (live.run.status !== lastStatus.current) { lastStatus.current = live.run.status; router.refresh() }
  }, [live.run.status, router])

  async function approve() {
    setApproving(true)
    const message = await post(`/api/runs/${runId}/approve`)
    setApproving(false)
    if (message) return toast(message)
    toast("Approved")
    router.refresh()
  }

  async function cancel() {
    setCancelling(true)
    const message = await post(`/api/runs/${runId}/cancel`)
    setCancelling(false)
    setCancelOpen(false)
    if (message) return toast(message)
    toast("Cancelled")
    router.refresh()
  }

  async function retry(stepId: string) {
    const message = await post(`/api/runs/${runId}/steps/${stepId}/retry`)
    if (message) toast(message)
  }

  const rail: RailStep[] = live.steps.map((s) => ({
    id: s.id, title: s.title, status: s.status,
    detail: s.status === "failed" ? (s.error ?? "This step failed.") : (s.message ?? undefined),
    timestamp: s.finished_at ? formatTime(s.finished_at) : undefined,
    onRetry: s.status === "failed" ? () => void retry(s.id) : undefined,
  }))
  const done = live.run.status === "completed"

  return (
    <div className="mt-10 max-w-[720px]">
      {cancelled ? (
        <div role="note" className="mb-8 rounded-group bg-mist p-4">
          <p className="t-body text-ink">This workflow was cancelled. Nothing was done.</p>
        </div>
      ) : null}

      {beforeApproval ? (
        <Section title="Who gets drafts" className="mt-0">
          {!preview.targetRunId ? (
            <p className="t-body py-2 text-ink-2">There is no assessment workflow to follow up on yet. Create one first.</p>
          ) : preview.recipients.length === 0 ? (
            <p className="t-body py-2 text-ink-2">No one needs a follow-up right now. Rekrutly will still review the pipeline.</p>
          ) : (
            <GroupedList>
              {preview.recipients.map((r) => (
                <ListRow key={r.id} title={r.name} subtitle={`Hasn't started the ${preview.targetTitle ?? "assessment"}`} value={r.hasEmail ? undefined : "No email"} />
              ))}
            </GroupedList>
          )}
        </Section>
      ) : null}

      <Section title="Steps" className={beforeApproval ? undefined : "mt-0"}>
        <ProgressRail steps={rail} />
      </Section>

      {beforeApproval ? (
        <div className="mt-8">
          <p className="t-callout text-ink-2">Nothing will be sent. You&apos;ll review each message.</p>
          <div className="mt-4 flex items-center gap-3">
            <Button loading={approving} disabled={!preview.targetRunId} onClick={() => void approve()}>Approve and draft messages</Button>
            <Button variant="secondary" onClick={() => setCancelOpen(true)}>Cancel</Button>
          </div>
        </div>
      ) : null}

      {done && targetRunId ? (
        <div className="mt-8">
          <p className="t-body text-ink">Drafts are ready. Copy them or open them in WhatsApp from the War Room.</p>
          <div className="mt-4"><Button asChild variant="secondary"><Link href={`/runs/${targetRunId}/war-room`}>Open War Room</Link></Button></div>
        </div>
      ) : null}

      <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel this workflow?</DialogTitle>
            <DialogDescription>Nothing has been sent. You can start a new one from the Command Centre.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setCancelOpen(false)}>Keep it</Button>
            <Button variant="destructive" loading={cancelling} onClick={() => void cancel()}>Cancel workflow</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
