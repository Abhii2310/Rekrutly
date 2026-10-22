"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { toast } from "@/components/ui/toaster"
import { whenLabel } from "@/lib/interviews/rules"
import type { InterviewView } from "@/lib/hr/types"

const LABEL = { proposed: "Waiting for them to choose", scheduled: "Booked", completed: "Done", cancelled: "Cancelled" } as const

function defaultSlot(): string {
  // Tomorrow, 4 pm, in the browser's own time, as the value a datetime-local box wants.
  const d = new Date(Date.now() + 86_400_000)
  d.setHours(16, 0, 0, 0)
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/** Book a live interview: pick a time, and the candidate gets an email with a join link and a calendar link. */
export function InterviewPanel({ candidateId, candidateName, email, interviews }: { candidateId: string; candidateName: string; email: string | null; interviews: InterviewView[] }) {
  const router = useRouter()
  const [open, setOpen] = React.useState(false)
  const [slot, setSlot] = React.useState("")
  const [choose, setChoose] = React.useState(false)
  const [extra, setExtra] = React.useState<string[]>(["", ""])
  const [minutes, setMinutes] = React.useState("30")
  const [url, setUrl] = React.useState("")
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  async function book(e: React.FormEvent) {
    e.preventDefault()
    if (busy) return
    setBusy(true)
    setError(null)
    try {
      const res = await fetch(`/api/candidates/${candidateId}/interviews`, {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ...(choose
            ? { slots: [slot, ...extra].filter(Boolean).map((t) => new Date(t).toISOString()) }
            : { scheduledAt: new Date(slot).toISOString() }),
          durationMinutes: Number(minutes) || 30, meetingUrl: url.trim() || null,
        }),
      })
      const json = (await res.json().catch(() => null)) as { data?: { emailed: string }; error?: { message?: string } } | null
      if (res.ok) {
        toast(choose ? (json?.data?.emailed === "sent" ? `Times sent. ${candidateName} will choose one.` : "Times saved. They were not emailed, so copy the link from the interview page.") : json?.data?.emailed === "sent" ? `Booked, and ${candidateName} was emailed` : json?.data?.emailed === "failed" ? "Booked, but the email failed. Copy the link from the interview page." : "Booked. They were not emailed, so copy the link from the interview page.")
        setOpen(false)
        setUrl("")
        router.refresh()
      } else setError(json?.error?.message ?? "Couldn't book. Try again.")
    } catch {
      setError("Couldn't reach the server. Check your connection and try again.")
    }
    setBusy(false)
  }

  return (
    <div>
      {interviews.length === 0 ? <p className="t-callout text-ink-2">No interview yet. Booking one emails the candidate a join link and a calendar link.</p> : (
        <ul className="flex flex-col gap-2">
          {interviews.map((i) => (
            <li key={i.id} className="flex items-center justify-between gap-3 rounded-control bg-mist px-4 py-3">
              <span className="min-w-0">
                <span className="t-body block text-ink">{i.status === "proposed" ? `${(i.proposedSlots ?? []).length} times offered` : whenLabel(new Date(i.scheduledAt))}</span>
                <span className="t-footnote text-ink-2">{LABEL[i.status]}, {i.durationMinutes} min{i.scorecard ? ". Scorecard saved" : ""}{i.status === "scheduled" ? (i.emailStatus === "sent" ? ". Candidate emailed" : ". Not emailed") : ""}</span>
              </span>
              <Button asChild variant="secondary" size="sm"><Link href={`/interviews/${i.id}`}>{i.status === "scheduled" || i.status === "proposed" ? "Open room" : "View"}</Link></Button>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-3"><Button variant="secondary" size="sm" onClick={() => { setSlot(defaultSlot()); setError(null); setOpen(true) }}>Schedule an interview</Button></div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[480px]">
          <form onSubmit={(e) => void book(e)} className="flex flex-col gap-4">
            <DialogHeader>
              <DialogTitle>Interview with {candidateName}</DialogTitle>
              <DialogDescription>{email ? `They get an email at ${email} with the time, a join link and a calendar link.` : "They have no email yet, so you will copy the join link and send it yourself."}</DialogDescription>
            </DialogHeader>
            <div className="flex gap-2" role="radiogroup" aria-label="How to set the time">
              {[[false, "I pick the time"], [true, "Let them choose"]].map(([v, label]) => (
                <button key={String(v)} type="button" role="radio" aria-checked={choose === v} onClick={() => setChoose(v as boolean)}
                  className={`focus-ring t-callout rounded-full px-4 py-1.5 transition-colors ${choose === v ? "bg-ink text-canvas" : "bg-fog text-ink hover:bg-hairline"}`}>{label as string}</button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <label className="t-callout col-span-2 flex flex-col gap-1.5 text-ink sm:col-span-1">{choose ? "First option" : "Date and time"}<Input type="datetime-local" value={slot} onChange={(e) => setSlot(e.target.value)} required /></label>
              <label className="t-callout col-span-2 flex flex-col gap-1.5 text-ink sm:col-span-1">Length (minutes)<Input type="number" min={10} max={180} step={5} value={minutes} onChange={(e) => setMinutes(e.target.value)} /></label>
            </div>
            {choose ? (
              <div className="grid gap-3 sm:grid-cols-2">
                {extra.map((v, n) => (
                  <label key={n} className="t-callout flex flex-col gap-1.5 text-ink">{n === 0 ? "Second option" : "Third option (optional)"}<Input type="datetime-local" value={v} onChange={(e) => setExtra((x) => x.map((y, k) => (k === n ? e.target.value : y)))} required={n === 0} /></label>
                ))}
              </div>
            ) : null}
            <label className="t-callout flex flex-col gap-1.5 text-ink">
              Video call link (optional)
              <Input type="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://meet.google.com/…" />
              <span className="t-footnote text-ink-2">Paste your own Google Meet or Zoom link. Leave it empty and a free Jitsi room is made for this interview.</span>
            </label>
            {error ? <p role="alert" className="t-callout text-danger">{error}</p> : null}
            <DialogFooter>
              <Button type="button" variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit" loading={busy} disabled={!slot || (choose && !extra[0])}>{choose ? "Send the options" : "Book and send"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
