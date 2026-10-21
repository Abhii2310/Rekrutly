"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "@/components/ui/toaster"

type Outcome = { created: number; skipped: { row: number; reason: string }[] }

const SAMPLE = "name,email,phone,title,company,years,location,skills\nAsha Rao,asha@example.com,+91 98765 43210,Frontend Engineer,Acme,4,Pune,React; TypeScript"

/** Adds candidates to a job from a CSV file or pasted text. Rows that can't be used are listed with the reason. */
export function ImportCandidatesDialog({ jobId }: { jobId: string }) {
  const router = useRouter()
  const [open, setOpen] = React.useState(false)
  const [csv, setCsv] = React.useState("")
  const [pending, setPending] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [outcome, setOutcome] = React.useState<Outcome | null>(null)

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 200_000) return setError("That file is too large. Import up to 200 candidates at a time.")
    const reader = new FileReader()
    reader.onload = () => { setCsv(String(reader.result ?? "")); setError(null); setOutcome(null) }
    reader.onerror = () => setError("Couldn't read that file.")
    reader.readAsText(file)
  }

  async function submit() {
    if (pending) return
    setPending(true)
    setError(null)
    try {
      const res = await fetch(`/api/jobs/${jobId}/candidates/import`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ csv }) })
      const body = (await res.json().catch(() => null)) as { data?: Outcome; error?: { message?: string } } | null
      if (res.ok && body?.data) {
        setOutcome(body.data)
        if (body.data.created > 0) { toast(`Imported ${body.data.created} ${body.data.created === 1 ? "candidate" : "candidates"}`); router.refresh() }
      } else setError(body?.error?.message ?? "Couldn't import. Try again.")
    } catch {
      setError("Couldn't reach the server. Check your connection and try again.")
    }
    setPending(false)
  }

  return (
    <>
      <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>Import CSV</Button>
      <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) { setCsv(""); setError(null); setOutcome(null) } }}>
        <DialogContent className="sm:max-w-[560px]">
          <DialogHeader>
            <DialogTitle>Import candidates</DialogTitle>
            <DialogDescription>
              Choose a CSV file or paste it. The first row needs a name column; email, phone, title, company, years, location and skills are optional. Separate skills with semicolons. Nothing is sent to anyone.
            </DialogDescription>
          </DialogHeader>
          <label className="t-callout flex flex-col gap-1.5 text-ink">
            CSV file
            <input type="file" accept=".csv,text/csv" onChange={onFile} className="focus-ring t-callout text-ink-2 file:mr-3 file:rounded-full file:border-0 file:bg-fog file:px-3.5 file:py-1.5 file:text-ink" />
          </label>
          <Textarea aria-label="CSV text" placeholder={SAMPLE} value={csv} onChange={(e) => { setCsv(e.target.value); setOutcome(null) }} className="min-h-40 font-mono text-[13px]" />
          {error ? <p role="alert" className="t-callout text-danger">{error}</p> : null}
          {outcome ? (
            <div role="status" className="rounded-group bg-mist p-4">
              <p className="t-body text-ink">Imported {outcome.created}. Skipped {outcome.skipped.length}.</p>
              {outcome.skipped.length > 0 ? (
                <ul className="t-callout mt-2 max-h-32 list-disc overflow-y-auto pl-5 text-ink-2">
                  {outcome.skipped.slice(0, 20).map((s) => <li key={s.row}>Row {s.row}: {s.reason}</li>)}
                </ul>
              ) : null}
            </div>
          ) : null}
          <DialogFooter>
            <Button variant="secondary" onClick={() => setOpen(false)}>{outcome ? "Done" : "Cancel"}</Button>
            <Button loading={pending} disabled={csv.trim().length === 0 || Boolean(outcome && outcome.created > 0)} onClick={() => void submit()}>Import</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
