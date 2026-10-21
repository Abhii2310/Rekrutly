"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { GroupedList, ListRow } from "@/components/ui/grouped-list"
import { ProgressRail, type RailStep } from "@/components/ui/progress-rail"
import { Section } from "@/components/ui/section"
import { StatusPill } from "@/components/ui/status-pill"
import { SimulatedTag } from "@/components/ui/tags"
import { toast } from "@/components/ui/toaster"
import { usePoll } from "@/hooks/use-poll"
import { copyText } from "@/lib/copy-text"
import { formatRelative, formatTime } from "@/lib/format"
import type { RunLive as RunLiveData } from "@/lib/db/queries/live"

const ACTOR = { recruiter: "You", agent: "Rekrutly", system: "System", candidate: "Candidate" } as const
const DELIVERY = { sent: "Email sent", failed: "Email failed", unconfigured: "Email not sent", not_sent: "Email not sent" } as const

async function post(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { method: "POST" })
    if (res.ok) return null
    const json = (await res.json().catch(() => null)) as { error?: { message?: string } } | null
    return json?.error?.message ?? "Something went wrong. Try again."
  } catch {
    return "Couldn't reach the server. Check your connection and retry."
  }
}

async function fetchLink(id: string): Promise<string | null> {
  try {
    const res = await fetch(`/api/invitations/${id}/link`, { cache: "no-store" })
    if (!res.ok) return null
    return ((await res.json()) as { data: { url: string } }).data.url
  } catch {
    return null
  }
}

/** After approval: the rail fills in from real events, with candidate links and the activity list beside it. */
export function RunLive({ runId, initial }: { runId: string; initial: RunLiveData }) {
  const router = useRouter()
  const { data: live = initial, reconnecting } = usePoll<RunLiveData>(`/api/runs/${runId}/live`, { initial })
  const [busy, setBusy] = React.useState(false)
  // The header badge is rendered by the server, so refresh it whenever the run's status changes.
  const lastStatus = React.useRef(initial.run.status)
  React.useEffect(() => {
    if (live.run.status !== lastStatus.current) {
      lastStatus.current = live.run.status
      router.refresh()
    }
  }, [live.run.status, router])
  const paused = live.run.status === "paused"
  const canPause = live.run.status === "executing" || live.run.status === "waiting"

  async function control(kind: "pause" | "resume") {
    setBusy(true)
    const message = await post(`/api/runs/${runId}/${kind}`)
    setBusy(false)
    if (message) toast(message)
    router.refresh()
  }

  async function retry(stepId: string) {
    const message = await post(`/api/runs/${runId}/steps/${stepId}/retry`)
    if (message) toast(message)
  }

  async function copy(id: string) {
    const url = await fetchLink(id)
    if (!url) return toast("Couldn't get the link. Try again.")
    if (await copyText(url)) toast("Link copied")
    else toast("Couldn't copy. Open the link instead.")
  }

  async function open(id: string) {
    const tab = window.open("", "_blank") // opened first so the browser doesn't block it
    const url = await fetchLink(id)
    if (url && tab) tab.location.href = url
    else {
      tab?.close()
      toast("Couldn't open the link. Try again.")
    }
  }

  const rail: RailStep[] = live.steps.map((s) => ({
    id: s.id,
    title: s.title,
    status: s.status,
    detail: s.status === "failed" ? (s.error ?? "This step failed.") : (s.message ?? undefined),
    timestamp: s.finished_at ? formatTime(s.finished_at) : undefined,
    onRetry: s.status === "failed" ? () => void retry(s.id) : undefined,
  }))

  return (
    <div className="grid gap-12 lg:grid-cols-[minmax(0,360px)_minmax(0,1fr)]">
      <div className="min-w-0">
        <div className="mb-5 flex items-center justify-between gap-3">
          <h2 className="t-title text-ink">Steps</h2>
          {canPause ? <Button variant="secondary" size="sm" loading={busy} onClick={() => control("pause")}>Pause</Button> : null}
          {paused ? <Button variant="secondary" size="sm" loading={busy} onClick={() => control("resume")}>Resume</Button> : null}
        </div>
        {paused ? (
          <div role="note" className="mb-5 rounded-group bg-warning-tint p-4">
            <p className="t-callout text-ink">Paused. Rekrutly won&apos;t take any new actions until you resume.</p>
          </div>
        ) : null}
        <ProgressRail steps={rail} />
        {reconnecting ? <p className="t-callout mt-6 text-ink-2" aria-live="polite">Reconnecting…</p> : null}
      </div>

      <div className="min-w-0">
        <Section
          title="Candidate links"
          className="mt-0"
          action={live.assessment ? <Button asChild variant="plain" size="sm"><Link href={`/assessments/${live.assessment.id}/results`}>View results</Link></Button> : undefined}
        >
          {live.invitations.length === 0 ? (
            <p className="t-body py-2 text-ink-2">Links appear here once they are created.</p>
          ) : (
            <GroupedList>
              {live.invitations.map((i) => (
                <ListRow
                  key={i.id}
                  title={i.name}
                  subtitle={
                    i.status === "started" && i.current_question
                      ? `Question ${i.current_question} of ${live.assessment?.question_count ?? ""}`
                      : i.status === "submitted"
                        ? "Submitted"
                        : i.has_email ? (DELIVERY[i.delivery_status] ?? "Email not sent") : "No email, share the link"
                  }
                  pill={<StatusPill kind="invitation" value={i.status} />}
                  actions={
                    <>
                      <Button variant="plain" size="sm" onClick={() => void copy(i.id)}>Copy link</Button>
                      <Button variant="plain" size="sm" onClick={() => void open(i.id)}>Open</Button>
                    </>
                  }
                />
              ))}
            </GroupedList>
          )}
        </Section>

        <Section title="Activity">
          {live.events.length === 0 ? (
            <p className="t-body py-2 text-ink-2">Activity will appear here as Rekrutly works.</p>
          ) : (
            <div aria-live="polite">
              <GroupedList>
                {live.events.map((e) => (
                  <ListRow
                    key={e.id}
                    title={<span className="t-body font-normal">{e.message}</span>}
                    subtitle={ACTOR[e.actor]}
                    value={formatRelative(e.created_at, live.serverNow)}
                    pill={e.is_simulated ? <SimulatedTag /> : undefined}
                  />
                ))}
              </GroupedList>
            </div>
          )}
        </Section>
      </div>
    </div>
  )
}
