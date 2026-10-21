"use client"

import * as React from "react"
import { ChevronRight } from "lucide-react"
import { firstLine } from "@/components/questions/rich-text"
import { AIMark } from "@/components/ui/ai-mark"
import type { DetailQuestion } from "@/lib/db/queries/submission"
import { describeChoice } from "@/lib/scoring/labels"
import { EvidenceSheet } from "./evidence-sheet"

function points(q: DetailQuestion): string {
  if (!q.score) return `– of ${q.max_score}`
  if (q.score.unanswered) return "Unanswered"
  return `${q.score.overridden_score ?? q.score.score} of ${q.score.max_score}`
}

/** Every question with its result. Written answers open the evidence sheet. */
export function QuestionResults({ questions, scoringDone }: { questions: DetailQuestion[]; scoringDone: boolean }) {
  const [openId, setOpenId] = React.useState<string | null>(null)
  const open = questions.find((q) => q.id === openId) ?? null

  return (
    <>
      <div className="rounded-group bg-mist p-1">
        <ul className="overflow-hidden rounded-[10px] bg-canvas">
          {questions.map((q, i) => {
            const written = q.type === "short"
            const adjusted = q.score?.overridden_score !== null && q.score?.overridden_score !== undefined
            const sub = written
              ? (q.answer?.text_answer?.trim() ? q.answer.text_answer.replace(/\s+/g, " ").slice(0, 110) : "Not answered")
              : describeChoice(q.answer?.selected_option ?? null, q.key?.correct_option ?? null)
            const canOpen = written && q.score !== null
            const label = `Question ${i + 1}`
            return (
              <li key={q.id} className="relative list-none after:absolute after:bottom-0 after:left-4 after:right-0 after:h-px after:bg-hairline/70 last:after:hidden">
                {/* The whole row opens the evidence. The click target is an overlay, so the AI mark (itself a button) is not nested inside it. */}
                {canOpen ? (
                  <button
                    type="button" onClick={() => setOpenId(q.id)} aria-label={`${label}: open the evidence`}
                    className="focus-ring absolute inset-0 transition-colors hover:bg-mist/60"
                  />
                ) : null}
                <div className="pointer-events-none relative flex min-h-14 w-full items-center gap-3 px-4 py-2 text-left">
                  <span className="t-callout tabular w-5 shrink-0 text-ink-2">{i + 1}</span>
                  <span className="min-w-0 flex-1">
                    <span className="t-body block truncate font-medium text-ink">{firstLine(q.prompt)}</span>
                    <span className="t-callout block truncate text-ink-2">{sub}</span>
                  </span>
                  <span className="flex shrink-0 flex-col items-end gap-0.5">
                    <span className="t-callout tabular font-medium text-ink">{written && !q.score && !scoringDone ? "Reviewing…" : points(q)}</span>
                    {written && q.score?.method === "ai_suggested" && !adjusted ? <span className="pointer-events-auto"><AIMark label="Suggested" /></span> : null}
                    {adjusted ? <span className="t-footnote text-ink-2">Adjusted</span> : null}
                  </span>
                  {canOpen ? <ChevronRight aria-hidden className="size-4 shrink-0 text-ink-3" strokeWidth={1.75} /> : <span className="w-4 shrink-0" />}
                </div>
              </li>
            )
          })}
        </ul>
      </div>
      <EvidenceSheet question={open} open={open !== null} onOpenChange={(o) => { if (!o) setOpenId(null) }} />
    </>
  )
}
