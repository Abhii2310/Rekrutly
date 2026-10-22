"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { cn } from "cn"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "@/components/ui/toaster"
import { SCORECARD_AREAS, type Scorecard } from "@/lib/hr/types"

async function patch(id: string, body: unknown): Promise<string | null> {
  try {
    const res = await fetch(`/api/interviews/${id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(body) })
    if (res.ok) return null
    const json = (await res.json().catch(() => null)) as { error?: { message?: string } } | null
    return json?.error?.message ?? "Couldn't save."
  } catch {
    return "Couldn't reach the server."
  }
}

/** Notes and a scorecard to fill in during the call. Ratings are per area. There is no hire button, on purpose. */
export function InterviewWorkspace({ id, status, initialNotes, initialScorecard }: { id: string; status: "scheduled" | "completed" | "cancelled"; initialNotes: string; initialScorecard: Scorecard | null }) {
  const router = useRouter()
  const [notes, setNotes] = React.useState(initialNotes)
  const [saved, setSaved] = React.useState<"idle" | "saving" | "saved" | "error">("idle")
  const [ratings, setRatings] = React.useState<Record<string, number>>(initialScorecard?.ratings ?? {})
  const [summary, setSummary] = React.useState(initialScorecard?.summary ?? "")
  const [busy, setBusy] = React.useState<null | "card" | "done" | "cancel">(null)
  const last = React.useRef(initialNotes)

  async function saveNotes() {
    if (notes === last.current) return
    setSaved("saving")
    const failed = await patch(id, { notes })
    if (failed) return setSaved("error")
    last.current = notes
    setSaved("saved")
  }

  async function saveCard() {
    setBusy("card")
    const failed = await patch(id, { scorecard: { ratings, summary } })
    setBusy(null)
    toast(failed ?? "Scorecard saved")
  }

  async function setStatus(next: "completed" | "cancelled") {
    setBusy(next === "completed" ? "done" : "cancel")
    const failed = await patch(id, { status: next })
    setBusy(null)
    if (failed) return toast(failed)
    toast(next === "completed" ? "Marked as done" : "Interview cancelled")
    router.refresh()
  }

  const complete = SCORECARD_AREAS.every((a) => ratings[a])

  return (
    <div className="flex flex-col gap-8">
      <section>
        <div className="mb-2 flex items-baseline justify-between"><h2 className="t-title text-ink">Notes</h2>
          <span className="t-footnote text-ink-2" aria-live="polite">{saved === "saving" ? "Saving…" : saved === "saved" ? "Saved" : saved === "error" ? "Not saved. Retry by clicking away." : "Saves when you click away"}</span></div>
        <Textarea aria-label="Interview notes" value={notes} onChange={(e) => { setNotes(e.target.value); setSaved("idle") }} onBlur={() => void saveNotes()} placeholder="What they said, examples they gave, follow-ups to ask." className="min-h-44 text-[15px] leading-6" />
      </section>

      <section>
        <h2 className="t-title mb-1 text-ink">Scorecard</h2>
        <p className="t-callout mb-4 text-ink-2">Rate what you saw in each area from 1 to 5. These are your notes for the decision. Rekrutly does not add them up or pick anyone.</p>
        <ul className="flex flex-col gap-4">
          {SCORECARD_AREAS.map((area) => (
            <li key={area} className="flex flex-wrap items-center justify-between gap-3">
              <span className="t-body text-ink">{area}</span>
              <span className="flex gap-1.5" role="radiogroup" aria-label={`${area} rating`}>
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n} type="button" role="radio" aria-checked={ratings[area] === n} onClick={() => setRatings((r) => ({ ...r, [area]: n }))}
                    className={cn("focus-ring tabular size-10 rounded-full text-[15px] transition-colors", ratings[area] === n ? "bg-ink text-canvas" : "bg-fog text-ink hover:bg-hairline")}
                  >{n}</button>
                ))}
              </span>
            </li>
          ))}
        </ul>
        <Textarea aria-label="Scorecard summary" value={summary} onChange={(e) => setSummary(e.target.value)} placeholder="Your overall impression in a few sentences." className="mt-4 min-h-24 text-[15px]" />
        <div className="mt-3"><Button variant="secondary" loading={busy === "card"} disabled={!complete} onClick={() => void saveCard()}>Save scorecard</Button>{!complete ? <span className="t-footnote ml-3 text-ink-2">Rate all four areas first.</span> : null}</div>
      </section>

      {status === "scheduled" ? (
        <div className="flex flex-wrap items-center gap-3 border-t border-hairline/60 pt-5">
          <Button loading={busy === "done"} onClick={() => void setStatus("completed")}>Mark interview as done</Button>
          <Button variant="destructive" loading={busy === "cancel"} onClick={() => void setStatus("cancelled")}>Cancel interview</Button>
        </div>
      ) : null}
    </div>
  )
}
