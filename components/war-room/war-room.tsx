"use client"

import * as React from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { GroupedList, ListRow } from "@/components/ui/grouped-list"
import { ProgressRail, type RailStep } from "@/components/ui/progress-rail"
import { Section } from "@/components/ui/section"
import { StatusPill } from "@/components/ui/status-pill"
import { SimulatedTag } from "@/components/ui/tags"
import { toast } from "@/components/ui/toaster"
import { usePoll } from "@/hooks/use-poll"
import { formatRelative, formatTime } from "@/lib/format"
import type { RunLive } from "@/lib/db/queries/live"
import { CandidateRows } from "./candidate-rows"
import { LiveAlerts } from "./live-alerts"
import { LiveCameras, StartNotices } from "./live-cameras"
import { NeedsYou } from "./needs-you"

const ACTOR = { recruiter: "You", agent: "Rekrutly", system: "System", candidate: "Candidate" } as const

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

/** The whole workflow on one screen, kept current by polling. */
export function WarRoom({ runId, initial }: { runId: string; initial: RunLive }) {
  const { data: live = initial, reconnecting } = usePoll<RunLive>(`/api/runs/${runId}/live`, { initial })
  const [busy, setBusy] = React.useState(false)
  const status = live.run.status
  const paused = status === "paused"
  const canPause = status === "executing" || status === "waiting"
  // Wrong addresses only show up as a bounce a little later, so look for bounces while invitations are out.
  const emailsOut = live.invitations.some((i) => i.delivery_status === "sent" && i.status !== "started" && i.status !== "submitted")
  React.useEffect(() => {
    if (!emailsOut) return
    let busy = false
    let runs = 0
    let timer: ReturnType<typeof setTimeout> | undefined
    const check = async () => {
      if (busy || document.visibilityState !== "visible") return schedule()
      busy = true
      try { await fetch("/api/delivery/check", { method: "POST" }) } catch { /* try again later */ }
      busy = false
      runs++
      schedule()
    }
    // Quick at first, when a bounce is most likely, then every minute. Never two at once.
    const schedule = () => { timer = setTimeout(() => void check(), runs < 3 ? 20_000 : 60_000) }
    timer = setTimeout(() => void check(), 4_000)
    return () => { if (timer) clearTimeout(timer) }
  }, [emailsOut])
  // Reminders that are due go out while someone is watching, even without a scheduler.
  React.useEffect(() => {
    const run = () => { if (document.visibilityState === "visible") void fetch("/api/reminders/run", { method: "POST" }).catch(() => {}) }
    const first = setTimeout(run, 15_000)
    const timer = setInterval(run, 5 * 60_000)
    return () => { clearTimeout(first); clearInterval(timer) }
  }, [])
  const submitted = live.invitations.filter((i) => i.status === "submitted").length

  async function control(kind: "pause" | "resume") {
    setBusy(true)
    const message = await post(`/api/runs/${runId}/${kind}`)
    setBusy(false)
    if (message) toast(message)
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

  return (
    <>
      <div className="mb-10 flex max-w-[1040px] flex-wrap items-center justify-between gap-x-6 gap-y-3">
        <p className="t-body min-w-0 max-w-[640px] text-ink">{live.run.summary}</p>
        <div className="flex items-center gap-3">
          <StatusPill kind="run" value={status} />
          {canPause ? <Button variant="secondary" size="sm" loading={busy} onClick={() => void control("pause")}>Pause</Button> : null}
          {paused ? <Button variant="secondary" size="sm" loading={busy} onClick={() => void control("resume")}>Resume</Button> : null}
        </div>
      </div>
      <StartNotices invitations={live.invitations} />
      {paused ? (
        <div role="note" className="mb-8 max-w-[1040px] rounded-group bg-warning-tint p-4">
          <p className="t-callout text-ink">Paused. Rekrutly won&apos;t take any new actions until you resume.</p>
        </div>
      ) : null}

      <div className="flex flex-col gap-12 xl:grid xl:grid-cols-[minmax(0,360px)_minmax(0,1fr)]">
        <div className="order-2 min-w-0 xl:order-1">
          <h2 className="t-title mb-5 text-ink">Steps</h2>
          <ProgressRail steps={rail} />
          {reconnecting ? <p className="t-callout mt-6 text-ink-2" aria-live="polite">Reconnecting…</p> : null}
        </div>

        <div className="order-1 min-w-0 xl:order-2">
          <Section
            title="Candidates" className="mt-0"
            action={live.assessment ? (
              <span className="flex items-center gap-3 whitespace-nowrap">
                <span className="t-callout tabular text-ink-2">{submitted} of {live.invitations.length} submitted</span>
                <Button asChild variant="plain" size="sm"><Link href={`/assessments/${live.assessment.id}/results`}>View results</Link></Button>
              </span>
            ) : undefined}
          >
            <CandidateRows invitations={live.invitations} questionCount={live.assessment?.question_count ?? 0} serverNow={live.serverNow} alerts={live.alerts} />
          </Section>

          {live.assessment?.proctored ? (
            <Section title="Live cameras">
              <LiveCameras invitations={live.invitations} serverNow={live.serverNow} />
            </Section>
          ) : null}

          {live.assessment?.proctored ? (
            <Section title="Live alerts">
              <LiveAlerts alerts={live.alerts} serverNow={live.serverNow} />
            </Section>
          ) : null}

          <Section title="Next actions">
            {live.nextActions.length === 0 ? (
              <p className="t-body py-2 text-ink-2">Nothing to do right now.</p>
            ) : (
              <GroupedList>
                {live.nextActions.map((a) => <ListRow key={a} wrap title={<span className="t-body font-normal">{a}</span>} />)}
              </GroupedList>
            )}
          </Section>

          <Section title="Needs you">
            <NeedsYou tasks={live.tasks} />
          </Section>

          <Section title="Activity">
            {live.events.length === 0 ? (
              <p className="t-body py-2 text-ink-2">Activity will appear here as Rekrutly works.</p>
            ) : (
              <div aria-live="polite">
                <GroupedList>
                  {live.events.slice(0, 12).map((e) => (
                    <ListRow
                      key={e.id}
                      wrap
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
    </>
  )
}
