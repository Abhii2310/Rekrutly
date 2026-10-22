"use client"

import * as React from "react"
import Link from "next/link"
import { Volume2, VolumeX } from "lucide-react"
import { GroupedList, ListRow } from "@/components/ui/grouped-list"
import { toast } from "@/components/ui/toaster"
import { formatRelative } from "@/lib/format"
import type { LiveAlert } from "@/lib/db/queries/live"
import { signalLabel } from "@/lib/proctor/signals"

/** A soft two-note chime. Needs the page to have been clicked once, which opening the War Room almost always means. */
function chime(ctx: AudioContext) {
  void ctx.resume().catch(() => {})
  const now = ctx.currentTime
  ;[660, 880].forEach((freq, n) => {
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = "sine"
    osc.frequency.value = freq
    gain.gain.setValueAtTime(0.0001, now + n * 0.16)
    gain.gain.exponentialRampToValueAtTime(0.18, now + n * 0.16 + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.0001, now + n * 0.16 + 0.35)
    osc.connect(gain).connect(ctx.destination)
    osc.start(now + n * 0.16)
    osc.stop(now + n * 0.16 + 0.4)
  })
}

export const reviewHref = (a: { invitation_id: string; video_ms: number | null }): string =>
  `/proctoring/${a.invitation_id}${a.video_ms !== null ? `?t=${Math.floor(a.video_ms / 1000)}` : ""}`

/** The newest moments worth a look across all candidates. New ones chime and show a notice. Signals for a person, never proof. */
export function LiveAlerts({ alerts, serverNow }: { alerts: LiveAlert[]; serverNow: string }) {
  const [sound, setSound] = React.useState(true)
  const seen = React.useRef<Set<string> | null>(null)
  const audio = React.useRef<AudioContext | null>(null)

  React.useEffect(() => {
    if (seen.current === null) { seen.current = new Set(alerts.map((a) => a.id)); return }
    const fresh = alerts.filter((a) => !seen.current?.has(a.id))
    if (fresh.length === 0) return
    for (const a of alerts) seen.current.add(a.id)
    const first = fresh[0]
    if (first) toast(`${first.name}: ${signalLabel(first.type).toLowerCase()}. Review this moment.`)
    if (sound) {
      try {
        audio.current ??= new AudioContext()
        chime(audio.current)
      } catch { /* no audio available */ }
    }
  }, [alerts, sound])

  return (
    <>
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="t-callout text-ink-2">Moments worth a look. These are signals, not proof of anything.</p>
        <button
          type="button" aria-pressed={sound} onClick={() => { setSound((v) => !v); try { audio.current ??= new AudioContext(); void audio.current.resume() } catch {} }}
          className="focus-ring t-callout inline-flex shrink-0 items-center gap-1.5 rounded text-action hover:text-action-hover"
        >
          {sound ? <Volume2 aria-hidden className="size-4" strokeWidth={1.75} /> : <VolumeX aria-hidden className="size-4" strokeWidth={1.75} />}
          {sound ? "Sound on" : "Sound off"}
        </button>
      </div>
      {alerts.length === 0 ? (
        <p className="t-body py-2 text-ink-2">Nothing flagged so far.</p>
      ) : (
        <div aria-live="polite">
          <GroupedList>
            {alerts.slice(0, 8).map((a) => (
              <ListRow
                key={a.id} wrap
                title={<span className="t-body font-normal">{a.name}: {signalLabel(a.type).toLowerCase()}</span>}
                subtitle={formatRelative(a.occurred_at, serverNow)}
                value={<Link href={reviewHref(a)} className="focus-ring t-callout rounded text-action hover:text-action-hover">Review this moment</Link>}
              />
            ))}
          </GroupedList>
        </div>
      )}
    </>
  )
}
