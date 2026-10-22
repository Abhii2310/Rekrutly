"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "@/components/ui/toaster"
import { formatDate } from "@/lib/format"
import type { OfferView } from "@/lib/hr/types"

async function call(url: string, method: string, body?: unknown): Promise<{ error: string | null; data: Record<string, unknown> | null }> {
  try {
    const res = await fetch(url, { method, headers: { "content-type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) })
    const json = (await res.json().catch(() => null)) as { data?: Record<string, unknown>; error?: { message?: string } } | null
    if (res.ok) return { error: null, data: json?.data ?? null }
    return { error: json?.error?.message ?? "Something went wrong. Try again.", data: null }
  } catch {
    return { error: "Couldn't reach the server. Check your connection and retry.", data: null }
  }
}

/** Draft an offer letter from a few details, edit it, then send it. Every step is the recruiter's; nothing is automatic. */
export function OfferPanel({ candidateId, candidateName, email, offers }: { candidateId: string; candidateName: string; email: string | null; offers: OfferView[] }) {
  const router = useRouter()
  const [draftOpen, setDraftOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<OfferView | null>(null)
  const [form, setForm] = React.useState({ company: "", compensation: "", startDate: "", signerName: "", signerTitle: "", deadlineDays: "7" })
  const [text, setText] = React.useState("")
  const [busy, setBusy] = React.useState<null | "draft" | "save" | "send" | "delete">(null)
  const [error, setError] = React.useState<string | null>(null)
  const [confirmSend, setConfirmSend] = React.useState(false)
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [k]: e.target.value }))

  async function create(e: React.FormEvent) {
    e.preventDefault()
    if (busy) return
    setBusy("draft")
    setError(null)
    const res = await call(`/api/candidates/${candidateId}/offers`, "POST", { ...form, deadlineDays: Number(form.deadlineDays) || 7, startDate: form.startDate || null })
    setBusy(null)
    if (res.error) return setError(res.error)
    setDraftOpen(false)
    toast("Draft written. Read it, edit it, then send it.")
    router.refresh()
  }

  function open(o: OfferView) { setEditing(o); setText(o.body); setError(null); setConfirmSend(false) }

  async function save(): Promise<boolean> {
    if (!editing) return false
    setBusy("save")
    setError(null)
    const res = await call(`/api/offers/${editing.id}`, "PATCH", { body: text })
    setBusy(null)
    if (res.error) { setError(res.error); return false }
    return true
  }

  async function send() {
    if (!editing || busy) return
    if (!(await save())) return
    setBusy("send")
    const res = await call(`/api/offers/${editing.id}/send`, "POST")
    setBusy(null)
    if (res.error) { setConfirmSend(false); return setError(res.error) }
    toast(`Offer sent to ${candidateName}`)
    setEditing(null)
    router.refresh()
  }

  async function remove() {
    if (!editing || busy) return
    setBusy("delete")
    const res = await call(`/api/offers/${editing.id}`, "DELETE")
    setBusy(null)
    if (res.error) return setError(res.error)
    setEditing(null)
    router.refresh()
  }

  return (
    <div>
      {offers.length === 0 ? <p className="t-callout text-ink-2">No offer yet. Write a draft when you are ready; nothing is sent until you press Send.</p> : (
        <ul className="flex flex-col gap-2">
          {offers.map((o) => (
            <li key={o.id} className="flex items-center justify-between gap-3 rounded-control bg-mist px-4 py-3">
              <span className="min-w-0">
                <span className="t-body block text-ink">{o.title}</span>
                <span className="t-footnote text-ink-2">{o.status === "sent" && o.sentAt ? `Sent ${formatDate(o.sentAt)}` : "Draft, not sent"}{o.startDate ? `. Starts ${formatDate(o.startDate)}` : ""}</span>
              </span>
              <Button variant="secondary" size="sm" onClick={() => open(o)}>{o.status === "sent" ? "View" : "Edit and send"}</Button>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-3"><Button variant="secondary" size="sm" onClick={() => { setDraftOpen(true); setError(null) }}>Draft an offer letter</Button></div>

      <Dialog open={draftOpen} onOpenChange={setDraftOpen}>
        <DialogContent className="sm:max-w-[520px]">
          <form onSubmit={(e) => void create(e)} className="flex flex-col gap-4">
            <DialogHeader>
              <DialogTitle>Offer letter for {candidateName}</DialogTitle>
              <DialogDescription>These details are put into a standard letter. Nothing is made up, and you can edit the whole letter before sending.</DialogDescription>
            </DialogHeader>
            <label className="t-callout flex flex-col gap-1.5 text-ink">Company name<Input value={form.company} onChange={set("company")} placeholder="Acme" required /></label>
            <label className="t-callout flex flex-col gap-1.5 text-ink">Compensation<Input value={form.compensation} onChange={set("compensation")} placeholder="₹18,00,000 per year" /></label>
            <div className="grid grid-cols-2 gap-3">
              <label className="t-callout flex flex-col gap-1.5 text-ink">Start date<Input type="date" value={form.startDate} onChange={set("startDate")} /></label>
              <label className="t-callout flex flex-col gap-1.5 text-ink">Reply within (days)<Input type="number" min={1} max={30} value={form.deadlineDays} onChange={set("deadlineDays")} /></label>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <label className="t-callout flex flex-col gap-1.5 text-ink">Signed by<Input value={form.signerName} onChange={set("signerName")} placeholder="Your name" required /></label>
              <label className="t-callout flex flex-col gap-1.5 text-ink">Their title<Input value={form.signerTitle} onChange={set("signerTitle")} placeholder="Hiring Manager" /></label>
            </div>
            {error ? <p role="alert" className="t-callout text-danger">{error}</p> : null}
            <DialogFooter>
              <Button type="button" variant="secondary" onClick={() => setDraftOpen(false)}>Cancel</Button>
              <Button type="submit" loading={busy === "draft"} disabled={!form.company.trim() || !form.signerName.trim()}>Write the draft</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={editing !== null} onOpenChange={(o) => { if (!o) setEditing(null) }}>
        <DialogContent className="sm:max-w-[640px]">
          <DialogHeader>
            <DialogTitle>{editing?.status === "sent" ? "Offer letter (sent)" : "Review the offer letter"}</DialogTitle>
            <DialogDescription>{editing?.status === "sent" ? "This letter was sent and can't be changed." : "Edit anything you like. It goes to the candidate exactly as written here."}</DialogDescription>
          </DialogHeader>
          <Textarea aria-label="Offer letter" value={text} onChange={(e) => setText(e.target.value)} readOnly={editing?.status === "sent"} className="min-h-72 font-sans text-[15px] leading-6" />
          {error ? <p role="alert" className="t-callout text-danger">{error}</p> : null}
          {editing?.status === "draft" ? (
            confirmSend ? (
              <div className="rounded-control bg-warning-tint p-4">
                <p className="t-callout text-ink">{email ? `This emails the letter to ${email}. It can't be unsent.` : "Add this candidate's email first."}</p>
                <div className="mt-3 flex gap-2">
                  <Button size="sm" loading={busy === "send"} disabled={!email} onClick={() => void send()}>Yes, send the offer</Button>
                  <Button size="sm" variant="secondary" onClick={() => setConfirmSend(false)}>Not yet</Button>
                </div>
              </div>
            ) : (
              <DialogFooter className="sm:justify-between">
                <span className="flex items-center gap-3">
                  <Button variant="destructive" size="sm" loading={busy === "delete"} onClick={() => void remove()}>Delete draft</Button>
                  <a href={`/offers/${editing.id}`} target="_blank" rel="noreferrer" className="focus-ring t-callout rounded text-action hover:text-action-hover">Print view</a>
                </span>
                <span className="flex gap-2">
                  <Button variant="secondary" loading={busy === "save"} onClick={() => void save().then((ok) => { if (ok) toast("Saved") })}>Save</Button>
                  <Button onClick={() => setConfirmSend(true)}>Send offer</Button>
                </span>
              </DialogFooter>
            )
          ) : (
            <DialogFooter><a href={editing ? `/offers/${editing.id}` : "#"} target="_blank" rel="noreferrer" className="focus-ring t-callout rounded text-action hover:text-action-hover">Print view</a></DialogFooter>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
