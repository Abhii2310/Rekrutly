"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Check, Minus } from "lucide-react"
import { RichText } from "@/components/questions/rich-text"
import { AIMark } from "@/components/ui/ai-mark"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Pill } from "@/components/ui/status-pill"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "@/components/ui/toaster"
import type { DetailQuestion } from "@/lib/db/queries/submission"
import { splitAtQuote } from "@/lib/scoring/labels"

const CONFIDENCE = { low: "Low confidence", medium: "Medium confidence", high: "High confidence" } as const

function OverrideForm({ q }: { q: DetailQuestion }) {
  const router = useRouter()
  const score = q.score
  const [value, setValue] = React.useState(String(score?.overridden_score ?? score?.score ?? 0))
  const [reason, setReason] = React.useState("")
  const [error, setError] = React.useState<string | null>(null)
  const [saving, setSaving] = React.useState(false)
  if (!score) return null

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!score) return
    setSaving(true)
    setError(null)
    try {
      const res = await fetch(`/api/question-scores/${score.id}`, {
        method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ score: Number(value), reason }),
      })
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: { message?: string } } | null
        setError(body?.error?.message ?? "Couldn't save the override.")
      } else {
        toast("Score updated")
        setReason("")
        router.refresh()
      }
    } catch {
      setError("Couldn't reach the server. Check your connection and retry.")
    }
    setSaving(false)
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <div className="grid grid-cols-[110px_1fr] gap-3">
        <label className="flex flex-col gap-1.5">
          <span className="t-callout font-medium text-ink">Score (0 to {score.max_score})</span>
          <Input type="number" inputMode="decimal" step="0.5" min={0} max={score.max_score} value={value} onChange={(e) => setValue(e.target.value)} />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="t-callout font-medium text-ink">Reason</span>
          <Textarea aria-label="Reason for the new score" placeholder="Why this score?" value={reason} onChange={(e) => setReason(e.target.value)} />
        </label>
      </div>
      {error ? <p role="alert" className="t-callout text-danger">{error}</p> : null}
      <div><Button type="submit" variant="secondary" loading={saving} disabled={reason.trim().length < 3 || value === ""}>Override score</Button></div>
    </form>
  )
}

/** The evidence behind a written-answer score: the answer with the quote highlighted, the rubric, the reasoning and the override. */
export function EvidenceSheet({ question, open, onOpenChange }: { question: DetailQuestion | null; open: boolean; onOpenChange: (open: boolean) => void }) {
  const q = question
  const answer = q?.answer?.text_answer ?? ""
  const s = q?.score
  const parts = splitAtQuote(answer, s?.evidence_quote ?? null)
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      {/* Do not auto-focus the first control: it is the AI mark, and focusing it would pop its tooltip over the answer. */}
      <SheetContent onOpenAutoFocus={(e) => e.preventDefault()}>
        {q && s ? (
          <>
            <SheetHeader>
              <SheetTitle>Written answer</SheetTitle>
              <SheetDescription>{q.skill}</SheetDescription>
            </SheetHeader>
            <div className="flex flex-col gap-7 px-8 pb-10">
              <section>
                <h3 className="t-headline mb-2 text-ink">Question</h3>
                <RichText text={q.prompt} />
              </section>

              <section>
                <h3 className="t-headline mb-2 text-ink">Answer</h3>
                {answer ? (
                  <p className="t-body whitespace-pre-wrap rounded-control bg-mist p-4 text-ink">
                    {parts.before}
                    {parts.match ? <mark className="rounded bg-ai-tint px-0.5 text-ink">{parts.match}</mark> : null}
                    {parts.after}
                  </p>
                ) : (
                  <p className="t-body text-ink-2">No answer was given.</p>
                )}
                {s.evidence_quote === null && answer && s.method === "ai_suggested" ? (
                  <p className="t-callout mt-2 text-ink-2">The grader&apos;s quote did not match the answer exactly, so none is highlighted.</p>
                ) : null}
              </section>

              <section>
                <div className="mb-2 flex items-center justify-between gap-3">
                  <h3 className="t-headline text-ink">Score</h3>
                  {s.method === "ai_suggested" ? <AIMark /> : null}
                </div>
                <p className="t-title tabular text-ink">{s.overridden_score ?? s.score} <span className="t-callout font-normal text-ink-2">of {s.max_score}</span></p>
                {s.overridden_score !== null ? (
                  <p className="t-callout mt-1 text-ink-2">You changed this from {s.score}. Reason: {s.override_reason}</p>
                ) : null}
                {s.confidence && !s.unanswered ? <div className="mt-3"><Pill tone={s.confidence === "low" ? "warning" : "neutral"}>{CONFIDENCE[s.confidence]}</Pill></div> : null}
                {s.reasoning ? <p className="t-body mt-3 text-ink">{s.reasoning}</p> : null}
              </section>

              {s.matched_criteria?.length || s.missing_criteria?.length ? (
                <section>
                  <h3 className="t-headline mb-2 text-ink">Rubric points</h3>
                  <ul className="flex flex-col gap-2">
                    {s.matched_criteria?.map((c) => (
                      <li key={`m-${c}`} className="t-body flex gap-2 text-ink"><Check aria-label="Covered" className="mt-1 size-4 shrink-0 text-success" strokeWidth={2.5} />{c}</li>
                    ))}
                    {s.missing_criteria?.map((c) => (
                      <li key={`x-${c}`} className="t-body flex gap-2 text-ink-2"><Minus aria-label="Not covered" className="mt-1 size-4 shrink-0 text-ink-3" strokeWidth={2.5} />{c}</li>
                    ))}
                  </ul>
                </section>
              ) : null}

              <section>
                <h3 className="t-headline mb-3 text-ink">Override score</h3>
                <OverrideForm key={`${s.id}-${s.overridden_score}`} q={q} />
              </section>
            </div>
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  )
}
