"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "@/components/ui/toaster"
import { rejectionText } from "@/lib/rejections/template"

/** Reject with a kind email you read and edit first, or reject without any email. Nothing happens until you press a button. */
export function RejectDialog({ candidateId, firstName, name, role, email, onDone }: { candidateId: string; firstName: string; name: string; role: string; email: string | null; onDone?: () => void }) {
  const router = useRouter()
  const draft = React.useMemo(() => rejectionText({ firstName, role }), [firstName, role])
  const [open, setOpen] = React.useState(false)
  const [text, setText] = React.useState(draft.body)
  const [busy, setBusy] = React.useState<null | "email" | "quiet">(null)
  const [report, setReport] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  async function reject(sendEmail: boolean) {
    if (busy) return
    setBusy(sendEmail ? "email" : "quiet")
    setError(null)
    try {
      const res = await fetch(`/api/candidates/${candidateId}/reject`, {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify(sendEmail ? { sendEmail: true, subject: draft.subject, body: text, includeReport: report } : { sendEmail: false }),
      })
      const json = (await res.json().catch(() => null)) as { error?: { message?: string } } | null
      if (res.ok) {
        toast(sendEmail ? `Rejected, and ${name} was emailed` : `${name} was rejected`)
        setOpen(false)
        onDone?.()
        router.refresh()
      } else setError(json?.error?.message ?? "Couldn't do that. Try again.")
    } catch {
      setError("Couldn't reach the server. Check your connection and try again.")
    }
    setBusy(null)
  }

  return (
    <>
      <Button variant="destructive" size="sm" onClick={() => { setText(draft.body); setError(null); setOpen(true) }}>Reject…</Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Reject {name}?</DialogTitle>
            <DialogDescription>{email ? `You can send this note to ${email}. Read it and edit it first. It can't be unsent.` : "They have no email, so you can only reject without one."}</DialogDescription>
          </DialogHeader>
          {email ? <Textarea aria-label="Rejection email" value={text} onChange={(e) => setText(e.target.value)} className="min-h-56 font-sans text-[15px] leading-6" /> : null}
          {email ? <label className="t-callout flex items-start gap-2 text-ink"><input type="checkbox" checked={report} onChange={(e) => setReport(e.target.checked)} className="mt-1" /><span>Add a private skills report link, if they took a test. It shows only their own results and what to practise, with no comparison and no answers.</span></label> : null}
          {error ? <p role="alert" className="t-callout text-danger">{error}</p> : null}
          <DialogFooter className="sm:justify-between">
            <Button variant="secondary" onClick={() => setOpen(false)}>Keep them</Button>
            <span className="flex gap-2">
              <Button variant="secondary" loading={busy === "quiet"} onClick={() => void reject(false)}>Reject without email</Button>
              {email ? <Button variant="destructive" loading={busy === "email"} disabled={text.trim().length < 20} onClick={() => void reject(true)}>Reject and send email</Button> : null}
            </span>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
