"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Check, Star } from "lucide-react"
import { cn } from "cn"
import { AIMark } from "@/components/ui/ai-mark"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "@/components/ui/toaster"
import type { HrData } from "@/lib/hr/types"

async function call(url: string, init: RequestInit): Promise<string | null> {
  try {
    const res = await fetch(url, init)
    if (res.ok) return null
    const json = (await res.json().catch(() => null)) as { error?: { message?: string } } | null
    return json?.error?.message ?? "Something went wrong. Try again."
  } catch {
    return "Couldn't reach the server. Check your connection and retry."
  }
}

/** Resume in, a skills match out, then the recruiter decides whether to shortlist. The score is a suggestion, never a decision. */
export function ResumePanel({ candidateId, roleTitle, hr }: { candidateId: string; roleTitle: string | null; hr: HrData }) {
  const router = useRouter()
  const [text, setText] = React.useState("")
  const [busy, setBusy] = React.useState<null | "save" | "score" | "list">(null)
  const [error, setError] = React.useState<string | null>(null)
  const m = hr.match

  async function saveText() {
    if (busy) return
    setBusy("save")
    setError(null)
    const failed = await call(`/api/candidates/${candidateId}/resume`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text }) })
    setBusy(null)
    if (failed) return setError(failed)
    setText("")
    toast("Resume saved")
    router.refresh()
  }

  async function upload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ""
    if (!file || busy) return
    setBusy("save")
    setError(null)
    const body = new FormData()
    body.set("file", file)
    const failed = await call(`/api/candidates/${candidateId}/resume`, { method: "POST", body })
    setBusy(null)
    if (failed) return setError(failed)
    toast("Resume saved")
    router.refresh()
  }

  async function score() {
    if (busy) return
    setBusy("score")
    setError(null)
    const failed = await call(`/api/candidates/${candidateId}/resume/score`, { method: "POST" })
    setBusy(null)
    if (failed) return setError(failed)
    router.refresh()
  }

  async function shortlist(next: boolean) {
    if (busy) return
    setBusy("list")
    const failed = await call(`/api/candidates/${candidateId}/shortlist`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ shortlisted: next }) })
    setBusy(null)
    if (failed) return toast(failed)
    toast(next ? "Shortlisted" : "Removed from the shortlist")
    router.refresh()
  }

  return (
    <div>
      {hr.resumeChars === 0 ? (
        <div className="flex flex-col gap-3">
          <p className="t-callout text-ink-2">Add a resume to see how well it matches {roleTitle ? `the ${roleTitle} role` : "the role"}. Upload a PDF or text file, or paste the text.</p>
          <label className="t-callout flex flex-col gap-1.5 text-ink">
            PDF or text file
            <input type="file" accept=".pdf,.txt,.md,application/pdf,text/plain" onChange={(e) => void upload(e)} className="focus-ring t-callout text-ink-2 file:mr-3 file:rounded-full file:border-0 file:bg-fog file:px-3.5 file:py-1.5 file:text-ink" />
          </label>
          <Textarea aria-label="Resume text" placeholder="Or paste the resume text here" value={text} onChange={(e) => setText(e.target.value)} className="min-h-32 text-[15px]" />
          <div><Button variant="secondary" loading={busy === "save"} disabled={text.trim().length < 40} onClick={() => void saveText()}>Save resume</Button></div>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-3">
          <span className="t-callout inline-flex items-center gap-1.5 text-ink-2"><Check aria-hidden className="size-4 text-success" strokeWidth={2} />Resume saved ({hr.resumeChars.toLocaleString()} characters)</span>
          <Button size="sm" loading={busy === "score"} onClick={() => void score()}>{m ? "Score again" : "Check the match"}</Button>
          <label className="focus-ring t-callout cursor-pointer rounded text-action hover:text-action-hover">
            Replace
            <input type="file" accept=".pdf,.txt,.md,application/pdf,text/plain" onChange={(e) => void upload(e)} className="sr-only" />
          </label>
        </div>
      )}

      {error ? <p role="alert" className="t-callout mt-3 text-danger">{error}</p> : null}

      {m ? (
        <div className="mt-5 rounded-group bg-mist p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="t-callout text-ink-2">Resume match for {m.jobTitle}</p>
              <p className="tabular mt-1 text-[44px] font-semibold leading-none tracking-[-0.03em] text-ink">{m.score}<span className="t-title text-ink-2">%</span></p>
            </div>
            {m.relevance !== null ? <AIMark /> : <span className="t-footnote text-ink-2">Skills count only</span>}
          </div>
          <p className="t-callout mt-3 text-ink-2">
            {Math.round(m.coverage.ratio * 100)}% of the role&apos;s skills appear in the resume (counted by code)
            {m.relevance !== null ? `, and the experience reads ${Math.round(m.relevance * 100)}% relevant (suggested by AI)` : ""}. A match score helps you look; it never decides.
          </p>
          <p className="t-body mt-3 text-ink">{m.summary}</p>

          <div className="mt-4 flex flex-wrap gap-2" aria-label="Skills">
            {m.coverage.matched.map((s) => <span key={s} className="t-footnote inline-flex items-center gap-1 rounded-full bg-success-tint px-2.5 py-1 text-success"><Check aria-hidden className="size-3" strokeWidth={3} />{s}</span>)}
            {m.coverage.missing.map((s) => <span key={s} className="t-footnote rounded-full bg-fog px-2.5 py-1 text-ink-2">{s}: not shown</span>)}
          </div>

          {m.strengths.length ? (
            <ul className="mt-4 flex flex-col gap-2.5">
              {m.strengths.map((s) => (
                <li key={s.quote}><p className="t-callout text-ink">{s.point}</p><p className="t-footnote mt-0.5 text-ink-2">&ldquo;{s.quote}&rdquo;</p></li>
              ))}
            </ul>
          ) : null}
          {m.gaps.length ? <p className="t-callout mt-4 text-ink-2">Not shown in the resume: {m.gaps.join(", ")}.</p> : null}

          <div className="mt-5 flex items-center gap-3 border-t border-hairline/60 pt-4">
            <Button variant={hr.shortlisted ? "secondary" : "primary"} size="sm" loading={busy === "list"} onClick={() => void shortlist(!hr.shortlisted)}>
              <Star aria-hidden className={cn("size-4", hr.shortlisted && "fill-current")} strokeWidth={1.75} />
              {hr.shortlisted ? "Shortlisted" : "Shortlist"}
            </Button>
            <span className="t-footnote text-ink-2">Your decision. Shortlisting does not email or move anyone.</span>
          </div>
        </div>
      ) : hr.resumeChars > 0 ? (
        <div className="mt-4 flex items-center gap-3">
          <Button variant={hr.shortlisted ? "secondary" : "plain"} size="sm" loading={busy === "list"} onClick={() => void shortlist(!hr.shortlisted)}>
            <Star aria-hidden className={cn("size-4", hr.shortlisted && "fill-current")} strokeWidth={1.75} />{hr.shortlisted ? "Shortlisted" : "Shortlist"}
          </Button>
        </div>
      ) : null}
    </div>
  )
}
