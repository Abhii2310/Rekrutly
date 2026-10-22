"use client"

import * as React from "react"
import { cn } from "cn"
import { formatTime } from "@/lib/format"
import { signalLabel } from "@/lib/proctor/signals"
import type { Flagged } from "@/lib/db/queries/proctoring"
import type { SegmentView } from "@/lib/proctor/service"

const clock = (ms: number): string => {
  const s = Math.max(0, Math.floor(ms / 1000))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`
}

/**
 * Plays the recording, which is stored as short pieces, as one video, with the flagged moments on a timeline.
 * Picking a moment jumps to five seconds before it. Moments are signals for a person to look at, never proof.
 */
/** Which piece holds this moment, and how far into that piece it is. */
function locate(segments: SegmentView[], ms: number): { k: number; within: number } {
  let k = segments.findIndex((s) => ms >= s.startedMs && ms < s.startedMs + s.durationMs)
  if (k < 0) k = ms < (segments[0]?.startedMs ?? 0) ? 0 : Math.max(0, segments.length - 1)
  return { k, within: Math.max(0, ms - (segments[k]?.startedMs ?? 0)) / 1000 }
}

export function ReviewPlayer({ segments, flagged, startAtSeconds }: { segments: SegmentView[]; flagged: Flagged[]; startAtSeconds: number }) {
  const video = React.useRef<HTMLVideoElement>(null)
  const [start] = React.useState(() => locate(segments, startAtSeconds * 1000))
  const [index, setIndex] = React.useState(start.k)
  const pendingSeek = React.useRef<number | null>(startAtSeconds > 0 ? start.within : null)
  const [now, setNow] = React.useState(0)

  const total = segments.length > 0 ? Math.max(...segments.map((s) => s.startedMs + s.durationMs)) : 0

  const seekTo = (ms: number) => {
    const { k, within } = locate(segments, ms)
    if (k === index) {
      if (video.current) { video.current.currentTime = within; void video.current.play().catch(() => {}) }
    } else {
      pendingSeek.current = within
      setIndex(k)
    }
  }

  if (segments.length === 0) {
    return <p className="t-body text-ink-2">No recording has arrived yet. Pieces appear here every 30 seconds while the candidate is taking the assessment.</p>
  }
  const current = segments[index]

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_340px]">
      <div className="min-w-0">
        <video
          key={current?.seq} ref={video} src={current?.url} controls playsInline className="aspect-[4/3] w-full max-w-[720px] rounded-group bg-ink object-contain"
          onLoadedMetadata={() => { if (video.current && pendingSeek.current !== null) { video.current.currentTime = pendingSeek.current; pendingSeek.current = null; void video.current.play().catch(() => {}) } }}
          onTimeUpdate={() => setNow((current?.startedMs ?? 0) + (video.current?.currentTime ?? 0) * 1000)}
          onEnded={() => { if (index < segments.length - 1) { pendingSeek.current = 0; setIndex(index + 1) } }}
        />
        <div className="relative mt-4 h-8 max-w-[720px]" aria-label="Timeline of flagged moments">
          <div className="absolute inset-x-0 top-3 h-2 rounded-full bg-fog" />
          {total > 0 ? <div className="absolute left-0 top-3 h-2 rounded-full bg-ink/30" style={{ width: `${Math.min(100, (now / total) * 100)}%` }} /> : null}
          {total > 0 ? flagged.filter((f) => f.videoMs !== null).map((f) => (
            <button
              key={f.id} type="button" title={`${signalLabel(f.type)} at ${clock(f.videoMs ?? 0)}`} aria-label={`${signalLabel(f.type)} at ${clock(f.videoMs ?? 0)}`}
              onClick={() => seekTo(Math.max(0, (f.videoMs ?? 0) - 5000))}
              className="focus-ring absolute top-1 size-4 -translate-x-1/2 rounded-full bg-danger ring-2 ring-canvas"
              style={{ left: `${Math.min(100, ((f.videoMs ?? 0) / total) * 100)}%` }}
            />
          )) : null}
        </div>
        <p className="t-callout mt-1 text-ink-2">{clock(now)} of {clock(total)}. Each red dot is a moment to look at.</p>
      </div>

      <section aria-labelledby="flagged-title">
        <h2 id="flagged-title" className="t-title text-ink">Moments to review</h2>
        <p className="t-callout mt-1 text-ink-2">Signals, not proof. People look away, lean back or lose a connection for ordinary reasons.</p>
        {flagged.length === 0 ? (
          <p className="t-body mt-4 text-ink-2">Nothing was flagged.</p>
        ) : (
          <ul className="mt-4 flex flex-col gap-1">
            {flagged.map((f) => (
              <li key={f.id}>
                <button
                  type="button" disabled={f.videoMs === null} onClick={() => f.videoMs !== null && seekTo(Math.max(0, f.videoMs - 5000))}
                  className={cn("focus-ring flex min-h-11 w-full items-center justify-between gap-3 rounded-control bg-mist px-4 py-2 text-left transition-colors hover:bg-fog disabled:cursor-default disabled:hover:bg-mist")}
                >
                  <span className="t-body text-ink">{signalLabel(f.type)}</span>
                  <span className="t-callout tabular text-ink-2">{f.videoMs !== null ? clock(f.videoMs) : formatTime(f.occurredAt)}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
