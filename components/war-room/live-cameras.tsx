"use client"

import * as React from "react"
import { cn } from "cn"
import { toast } from "@/components/ui/toaster"
import type { LiveInvitation } from "@/lib/db/queries/live"
import { chime } from "./chime"

/** Pops a notice, with a chime, the moment a candidate starts or submits. Renders nothing. */
export function StartNotices({ invitations }: { invitations: LiveInvitation[] }) {
  const prev = React.useRef<Map<string, string> | null>(null)
  const audio = React.useRef<AudioContext | null>(null)

  React.useEffect(() => {
    const now = new Map(invitations.map((i) => [i.id, i.status]))
    const before = prev.current
    prev.current = now
    if (!before) return
    for (const i of invitations) {
      const was = before.get(i.id)
      if (was === i.status || was === undefined) continue
      if (i.status === "started") toast(`${i.name} just started the assessment.`)
      else if (i.status === "submitted") toast(`${i.name} submitted the assessment.`)
      else continue
      try {
        audio.current ??= new AudioContext()
        chime(audio.current)
      } catch { /* no audio available */ }
    }
  }, [invitations])

  return null
}

/** Larger live pictures of everyone who is taking a proctored test right now. A new picture arrives about every 5 seconds. */
export function LiveCameras({ invitations, serverNow }: { invitations: LiveInvitation[]; serverNow: string }) {
  const active = invitations.filter((i) => i.proctored && i.status === "started")
  if (active.length === 0) {
    return <p className="t-body py-2 text-ink-2">Cameras appear here when a candidate starts their assessment.</p>
  }
  return (
    <ul className="grid gap-3 sm:grid-cols-2">
      {active.map((i) => {
        const age = i.snapshot_at ? Math.round((Date.parse(serverNow) - Date.parse(i.snapshot_at)) / 1000) : null
        const stale = age !== null && age > 20
        return (
          <li key={i.id} className="overflow-hidden rounded-group bg-mist">
            <div className="relative aspect-[4/3] bg-ink">
              {i.snapshot_at ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={`/api/proctor/${i.id}/snapshot?v=${encodeURIComponent(i.snapshot_at)}`} alt={`Live camera of ${i.name}`} className={cn("size-full object-cover", stale && "opacity-40")} />
              ) : (
                <span className="t-callout absolute inset-0 flex items-center justify-center text-canvas/70">Waiting for the camera…</span>
              )}
              <span className="t-footnote absolute left-2 top-2 inline-flex items-center gap-1.5 rounded-full bg-ink/70 px-2 py-0.5 text-canvas">
                <span aria-hidden className={cn("size-2 rounded-full", stale ? "bg-warning" : "animate-pulse bg-[#FF453A]")} />
                {stale ? `No picture for ${age}s` : "Live"}
              </span>
            </div>
            <p className="t-callout px-3 py-2 text-ink">{i.name}{i.alerts > 0 ? <span className="text-danger">, {i.alerts} {i.alerts === 1 ? "alert" : "alerts"}</span> : null}</p>
          </li>
        )
      })}
    </ul>
  )
}
