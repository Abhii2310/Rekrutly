"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { toast } from "@/components/ui/toaster"

type Result = { file: string; status: "added" | "updated" | "skipped"; name?: string; email?: string | null; reason?: string }

/** Drop a stack of resumes on a role: each becomes a candidate. Then Score all ranks them by match. */
export function ResumeUploadDialog({ jobId, unscored }: { jobId: string; unscored: number }) {
  const router = useRouter()
  const [open, setOpen] = React.useState(false)
  const [files, setFiles] = React.useState<File[]>([])
  const [busy, setBusy] = React.useState<null | "upload" | "score">(null)
  const [results, setResults] = React.useState<Result[] | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const [left, setLeft] = React.useState<number | null>(null)

  async function upload() {
    if (busy || files.length === 0) return
    setBusy("upload")
    setError(null)
    try {
      const body = new FormData()
      files.forEach((f) => body.append("files", f))
      const res = await fetch(`/api/jobs/${jobId}/resumes`, { method: "POST", body })
      const json = (await res.json().catch(() => null)) as { data?: { results: Result[] }; error?: { message?: string } } | null
      if (res.ok && json?.data) {
        setResults(json.data.results)
        setFiles([])
        router.refresh()
      } else setError(json?.error?.message ?? "Couldn't upload. Try again.")
    } catch {
      setError("Couldn't reach the server. Check your connection and try again.")
    }
    setBusy(null)
  }

  async function scoreAll() {
    if (busy) return
    setBusy("score")
    setError(null)
    let total = 0
    try {
      for (let round = 0; round < 12; round++) {
        const res = await fetch(`/api/jobs/${jobId}/resumes/score`, { method: "POST" })
        const json = (await res.json().catch(() => null)) as { data?: { scored: number; failed: number; remaining: number }; error?: { message?: string } } | null
        if (!res.ok || !json?.data) { setError(json?.error?.message ?? "Scoring stopped. Press Score all again."); break }
        total += json.data.scored
        setLeft(json.data.remaining)
        if (json.data.remaining === 0 || json.data.scored === 0) break
      }
      toast(total > 0 ? `Scored ${total} ${total === 1 ? "resume" : "resumes"}` : "Nothing new to score")
      router.refresh()
    } catch {
      setError("Couldn't reach the server. Press Score all again.")
    }
    setBusy(null)
  }

  const added = results?.filter((r) => r.status !== "skipped").length ?? 0

  return (
    <>
      <Button variant="secondary" size="sm" onClick={() => { setOpen(true); setResults(null); setError(null) }}>Upload resumes</Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[560px]">
          <DialogHeader>
            <DialogTitle>Upload resumes</DialogTitle>
            <DialogDescription>Choose up to 25 PDFs or text files. Each becomes a candidate, with the name and email read from the resume. Check them afterwards. Nothing is sent to anyone.</DialogDescription>
          </DialogHeader>
          <label className="t-callout flex flex-col gap-1.5 text-ink">
            Resumes
            <input
              type="file" multiple accept=".pdf,.txt,.md,application/pdf,text/plain" onChange={(e) => { setFiles(Array.from(e.target.files ?? [])); setResults(null) }}
              className="focus-ring t-callout text-ink-2 file:mr-3 file:rounded-full file:border-0 file:bg-fog file:px-3.5 file:py-1.5 file:text-ink"
            />
          </label>
          {files.length > 0 ? <p className="t-callout text-ink-2">{files.length} {files.length === 1 ? "file" : "files"} chosen.</p> : null}
          {error ? <p role="alert" className="t-callout text-danger">{error}</p> : null}
          {results ? (
            <div role="status" className="max-h-56 overflow-y-auto rounded-group bg-mist p-4">
              <p className="t-body text-ink">{added} added or updated, {results.length - added} skipped.</p>
              <ul className="t-callout mt-2 flex flex-col gap-1 text-ink-2">
                {results.map((r) => <li key={r.file}>{r.status === "skipped" ? `${r.file}: ${r.reason}` : `${r.name}${r.email ? ` (${r.email})` : ", no email found"}${r.status === "updated" ? ", resume updated" : ""}`}</li>)}
              </ul>
            </div>
          ) : null}
          <DialogFooter className="sm:justify-between">
            <Button variant="plain" loading={busy === "score"} disabled={unscored === 0 && !results} onClick={() => void scoreAll()}>
              Score all{left !== null && busy === "score" ? ` (${left} left)` : unscored > 0 ? ` (${unscored} waiting)` : ""}
            </Button>
            <span className="flex gap-2">
              <Button variant="secondary" onClick={() => setOpen(false)}>Done</Button>
              <Button loading={busy === "upload"} disabled={files.length === 0} onClick={() => void upload()}>Upload</Button>
            </span>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
