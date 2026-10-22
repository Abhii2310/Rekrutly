"use client"

import * as React from "react"
import { cn } from "cn"
import { formatTime } from "@/lib/format"
import type { LiveAlert, LiveInvitation } from "@/lib/db/queries/live"
import { FixEmail, ResendButton } from "./fix-email"
import { reviewHref } from "./live-alerts"
import { signalLabel } from "@/lib/proctor/signals"
import { signalNote } from "@/lib/scoring/labels"
import { clockLabel, progressLabel } from "@/lib/tasks/labels"

const signature = (i: LiveInvitation): string => `${i.status}|${i.current_question ?? ""}|${i.submitted_at ?? ""}`

/** Seconds since the last poll answered, so the clock keeps counting between polls. Resets whenever `key` changes. */
function useElapsed(key: string): number {
  const [state, setState] = React.useState({ key, n: 0 })
  React.useEffect(() => {
    const id = setInterval(() => setState((s) => (s.key === key ? { key, n: s.n + 1 } : { key, n: 1 })), 1000)
    return () => clearInterval(id)
  }, [key])
  return state.key === key ? state.n : 0
}

const DOT: Record<string, string> = { started: "bg-action", submitted: "bg-success", opened: "bg-ink-3", expired: "bg-warning" }

/** Candidates in three aligned columns: name, where they are, time left or submitted time. */
export function CandidateRows({ invitations, questionCount, serverNow, alerts = [] }: { invitations: LiveInvitation[]; questionCount: number; serverNow: string; alerts?: LiveAlert[] }) {
  const elapsed = useElapsed(serverNow)

  // A row's dot pulses once when that row changes. Compared during render (React's "previous value" pattern), no effect needed.
  const [seen, setSeen] = React.useState<{ sigs: Record<string, string>; pulses: Record<string, number> }>(() => ({
    sigs: Object.fromEntries(invitations.map((i) => [i.id, signature(i)])), pulses: {},
  }))
  const changed = invitations.filter((i) => seen.sigs[i.id] !== signature(i))
  if (changed.length > 0) {
    const pulses = { ...seen.pulses }
    for (const i of changed) pulses[i.id] = seen.sigs[i.id] === undefined ? 0 : (pulses[i.id] ?? 0) + 1
    setSeen({ sigs: Object.fromEntries(invitations.map((i) => [i.id, signature(i)])), pulses })
  }

  if (invitations.length === 0) return <p className="t-body py-2 text-ink-2">Candidates appear here once their links are created.</p>

  return (
    <div className="rounded-group bg-mist p-1">
      <ul className="overflow-hidden rounded-[10px] bg-canvas">
        {invitations.map((i) => {
          const pulse = seen.pulses[i.id] ?? 0
          const latest = alerts.find((a) => a.invitation_id === i.id)
          const alertAge = latest ? Math.round((Date.parse(serverNow) - Date.parse(latest.occurred_at)) / 1000) + elapsed : null
          const recent = alertAge !== null && alertAge < 90
          const pictureAge = i.snapshot_at ? Math.round((Date.parse(serverNow) - Date.parse(i.snapshot_at)) / 1000) + elapsed : null
          return (
            <li key={i.id} className="relative grid min-h-14 list-none grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)_4.75rem] sm:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)_5.5rem] items-center gap-3 px-4 py-2 after:absolute after:bottom-0 after:left-4 after:right-0 after:h-px after:bg-hairline/70 last:after:hidden">
              <span className="flex min-w-0 items-center gap-2.5">
                {i.proctored && i.status === "started" && i.snapshot_at ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={`/api/proctor/${i.id}/snapshot?v=${encodeURIComponent(i.snapshot_at)}`} alt={`Live camera for ${i.name}`} width={64} height={48}
                    title={pictureAge !== null && pictureAge > 20 ? `No new picture for ${pictureAge} seconds` : "Live camera, updated every few seconds"}
                    className={cn("h-12 w-16 shrink-0 rounded-[8px] object-cover ring-2", recent ? "ring-danger" : "ring-transparent", pictureAge !== null && pictureAge > 20 && "opacity-40")}
                  />
                ) : (
                  <span key={pulse} aria-hidden className={cn("size-2 shrink-0 rounded-full", DOT[i.status] ?? "bg-fog", pulse > 0 && "dot-pulse")} />
                )}
                <span className="min-w-0">
                  <span className="t-headline block break-words text-ink">{i.name}</span>
                  {i.delivery_status === "sent" && i.status !== "started" && i.status !== "submitted" ? <ResendButton invitation={i} /> : null}
                  {latest && recent ? (
                    <span className="t-footnote block text-danger">
                      {signalLabel(latest.type)}.{" "}
                      <a href={reviewHref(latest)} className="focus-ring rounded underline underline-offset-2">Review this moment</a>
                    </span>
                  ) : null}
                  {signalNote(i.signals) ? <span className="t-footnote block text-ink-2" title="Hints for a person to look at, never proof.">{signalNote(i.signals)}</span> : null}
                </span>
              </span>
              <span className="t-callout tabular leading-snug text-ink-2">{progressLabel(i, questionCount)}</span>
              <span className="t-callout tabular text-right text-ink-2">
                {i.status === "started" && i.seconds_left !== null
                  ? clockLabel(i.seconds_left - elapsed)
                  : i.status === "submitted" && i.submitted_at ? formatTime(i.submitted_at) : "–"}
              </span>
              {i.delivery_status === "failed" && i.status !== "started" && i.status !== "submitted" ? <div className="col-span-full pb-1.5"><FixEmail invitation={i} /></div> : null}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
