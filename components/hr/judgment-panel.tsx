"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { cn } from "cn"
import { AIMark } from "@/components/ui/ai-mark"
import { Button } from "@/components/ui/button"
import { toast } from "@/components/ui/toaster"
import { OUTCOME_LABEL } from "@/lib/ai-task/rules"
import type { AiTaskView } from "@/lib/hr/types"

const TONE: Record<string, string> = {
  caught_and_fixed: "bg-success-tint text-success",
  avoided_claim: "bg-success-tint text-success",
  questioned_but_kept: "bg-warning-tint text-ink",
  used_without_checking: "bg-warning-tint text-ink",
  not_shown: "bg-fog text-ink-2",
}

/**
 * The Judgment Card: what happened when the candidate worked with an AI assistant that made one planted mistake. The outcome is
 * worked out by code from the text. There is no score and no ranking; the quotes are the evidence.
 */
export function JudgmentPanel({ task }: { task: AiTaskView | null }) {
  const router = useRouter()
  const [busy, setBusy] = React.useState(false)
  if (!task) return <p className="t-callout text-ink-2">No AI work task yet. Tick &ldquo;Test how they work with AI&rdquo; when you approve an assessment.</p>

  async function rewrite() {
    if (!task || busy) return
    setBusy(true)
    try {
      const res = await fetch(`/api/ai-tasks/${task.id}/review`, { method: "POST" })
      toast(res.ok ? "Notes written" : "Couldn't write the notes. Try again in a moment.")
      if (res.ok) router.refresh()
    } catch { toast("Couldn't reach the server.") }
    setBusy(false)
  }

  if (task.status === "in_progress") return <p className="t-body text-ink-2">In progress: {task.title}. The candidate has not submitted yet.</p>

  const m = task.metrics
  const outcome = m?.outcome ?? "not_shown"
  const r = task.review
  return (
    <div className="rounded-group bg-mist p-5">
      <p className="t-callout text-ink-2">{task.title}</p>
      <div className={cn("mt-2 inline-block rounded-full px-3 py-1 t-callout", TONE[outcome])}>{OUTCOME_LABEL[outcome]}</div>
      <div className="mt-4 rounded-control bg-canvas p-3.5">
        <p className="t-footnote text-ink-2">The assistant was set to say</p>
        <p className="t-callout mt-0.5 text-ink">&ldquo;{task.flaw.wrongStatement}&rdquo;</p>
        <p className="t-footnote mt-1 text-ink-2">{task.flaw.why}</p>
      </div>

      {m ? (
        <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-4">
          {[["Messages", String(m.prompts)], ["With context", `${m.withContext} of ${m.prompts}`], ["Asked it to check", String(m.verifyAsks)], ["Copied word for word", `${Math.round(m.copyShare * 100)}%`]].map(([k, v]) => (
            <div key={k}><dt className="t-footnote text-ink-2">{k}</dt><dd className="t-headline tabular text-ink">{v}</dd></div>
          ))}
        </dl>
      ) : null}
      <p className="t-footnote mt-2 text-ink-2">Counted by code from the text. Notes for you, not a score.</p>

      {r ? (
        <div className="mt-4">
          <div className="flex items-start justify-between gap-4"><p className="t-body text-ink">{r.summary}</p>{r.aiModel ? <AIMark /> : null}</div>
          {r.observations.length ? (
            <ul className="mt-3 flex flex-col gap-3">
              {r.observations.map((o) => (
                <li key={o.quote}><p className="t-callout text-ink">{o.note}</p><p className="t-footnote mt-0.5 text-ink-2">&ldquo;{o.quote}&rdquo;</p></li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : (
        <div className="mt-4 flex items-center gap-3"><p className="t-callout text-ink-2">The evidence notes are being written.</p><Button size="sm" variant="secondary" loading={busy} onClick={() => void rewrite()}>Write the notes now</Button></div>
      )}
      {r ? <div className="mt-3"><Button variant="plain" size="sm" loading={busy} onClick={() => void rewrite()}>Write the notes again</Button></div> : null}

      <details className="mt-4">
        <summary className="focus-ring t-callout cursor-pointer rounded text-action hover:text-action-hover">Read the conversation and the final answer</summary>
        <ul className="mt-3 flex flex-col gap-2.5">
          {task.chat.map((c, i) => (
            <li key={i} className={c.role === "assistant" ? "t-callout text-ink-2" : "t-callout text-ink"}>
              <span className="t-footnote block text-ink-3">{c.role === "assistant" ? "Assistant" : "Candidate"}</span>{c.text}
            </li>
          ))}
        </ul>
        <p className="t-footnote mt-4 text-ink-3">Final answer</p>
        <p className="t-body mt-1 whitespace-pre-wrap text-ink">{task.deliverable || "Nothing written."}</p>
      </details>
    </div>
  )
}
