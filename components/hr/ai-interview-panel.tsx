"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { AIMark } from "@/components/ui/ai-mark"
import { Button } from "@/components/ui/button"
import { toast } from "@/components/ui/toaster"
import type { AiInterviewView } from "@/lib/hr/types"

/** What was asked and said in the AI interview, with evidence notes and questions for a live interview. Notes, never a score. */
export function AiInterviewPanel({ ai }: { ai: AiInterviewView | null }) {
  const router = useRouter()
  const [busy, setBusy] = React.useState(false)
  if (!ai) return <p className="t-callout text-ink-2">No AI interview yet. Tick &ldquo;Add a talking AI interview&rdquo; when you approve an assessment.</p>

  async function rewrite() {
    if (!ai || busy) return
    setBusy(true)
    try {
      const res = await fetch(`/api/ai-interviews/${ai.id}/summarize`, { method: "POST" })
      toast(res.ok ? "Notes written" : "Couldn't write the notes. Try again in a moment.")
      if (res.ok) router.refresh()
    } catch {
      toast("Couldn't reach the server.")
    }
    setBusy(false)
  }

  const s = ai.summary
  return (
    <div>
      {ai.status === "in_progress" ? <p className="t-body text-ink-2">In progress. The candidate has not finished the conversation yet.</p> : null}
      {ai.status === "completed" && !s ? (
        <div className="flex items-center gap-3"><p className="t-body text-ink-2">Finished. The evidence notes are being written.</p><Button size="sm" variant="secondary" loading={busy} onClick={() => void rewrite()}>Write the notes now</Button></div>
      ) : null}
      {s ? (
        <div className="rounded-group bg-mist p-5">
          <div className="flex items-start justify-between gap-4"><p className="t-body text-ink">{s.overview}</p>{s.aiModel ? <AIMark /> : null}</div>
          <p className="t-footnote mt-2 text-ink-2">{s.answered} answered, {s.skipped} skipped. These are notes for you, not a score.</p>
          {s.observations.length ? (
            <ul className="mt-4 flex flex-col gap-3">
              {s.observations.map((o) => (
                <li key={o.quote}><p className="t-callout text-ink"><span className="text-ink-2">{o.area}: </span>{o.note}</p><p className="t-footnote mt-0.5 text-ink-2">&ldquo;{o.quote}&rdquo;</p></li>
              ))}
            </ul>
          ) : null}
          {s.probes.length ? (
            <div className="mt-4">
              <p className="t-callout text-ink-2">Worth asking in a live interview</p>
              <ul className="t-callout mt-1 list-disc pl-5 text-ink">{s.probes.map((p) => <li key={p}>{p}</li>)}</ul>
            </div>
          ) : null}
          <div className="mt-4"><Button variant="plain" size="sm" loading={busy} onClick={() => void rewrite()}>Write the notes again</Button></div>
        </div>
      ) : null}
      {ai.turns.length ? (
        <details className="mt-4">
          <summary className="focus-ring t-callout cursor-pointer rounded text-action hover:text-action-hover">Read the transcript</summary>
          <ul className="mt-3 flex flex-col gap-3">
            {ai.turns.map((t, i) => (
              <li key={i} className={t.role === "ai" ? "t-callout text-ink-2" : "t-callout text-ink"}>
                <span className="t-footnote block text-ink-3">{t.role === "ai" ? (t.kind === "followup" ? "Interviewer, follow-up" : "Interviewer") : "Candidate"}</span>
                {t.skipped ? <em>Skipped</em> : t.text}
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </div>
  )
}
