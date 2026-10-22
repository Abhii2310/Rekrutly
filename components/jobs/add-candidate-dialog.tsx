"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { toast } from "@/components/ui/toaster"

const EMPTY = { name: "", email: "", title: "", phone: "" }

/** Adds one candidate to a job by hand: name, email and role. Handy for adding someone live. */
export function AddCandidateDialog({ jobId }: { jobId: string }) {
  const router = useRouter()
  const [open, setOpen] = React.useState(false)
  const [form, setForm] = React.useState(EMPTY)
  const [pending, setPending] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const set = (k: keyof typeof EMPTY) => (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [k]: e.target.value }))

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (pending) return
    setPending(true)
    setError(null)
    try {
      const res = await fetch(`/api/jobs/${jobId}/candidates`, {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ full_name: form.name, email: form.email, current_title: form.title, phone: form.phone }),
      })
      const body = (await res.json().catch(() => null)) as { error?: { message?: string } } | null
      if (res.ok) {
        toast(`Added ${form.name.trim()}`)
        setOpen(false)
        setForm(EMPTY)
        router.refresh()
      } else setError(body?.error?.message ?? "Couldn't add. Try again.")
    } catch {
      setError("Couldn't reach the server. Check your connection and try again.")
    }
    setPending(false)
  }

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>Add candidate</Button>
      <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) { setForm(EMPTY); setError(null) } }}>
        <DialogContent className="sm:max-w-[480px]">
          <form onSubmit={(e) => void submit(e)} className="flex flex-col gap-4">
            <DialogHeader>
              <DialogTitle>Add a candidate</DialogTitle>
              <DialogDescription>Nothing is sent to them yet. They get an email only when you approve an assessment.</DialogDescription>
            </DialogHeader>
            <label className="t-callout flex flex-col gap-1.5 text-ink">
              Name
              <Input value={form.name} onChange={set("name")} placeholder="Asha Rao" autoFocus required />
            </label>
            <label className="t-callout flex flex-col gap-1.5 text-ink">
              Email
              <Input type="email" value={form.email} onChange={set("email")} placeholder="asha@gmail.com" />
              <span className="t-footnote text-ink-2">Check the spelling. A wrong address bounces and they never get the link.</span>
            </label>
            <label className="t-callout flex flex-col gap-1.5 text-ink">
              Role
              <Input value={form.title} onChange={set("title")} placeholder="Frontend Engineer" />
            </label>
            <label className="t-callout flex flex-col gap-1.5 text-ink">
              Phone (optional)
              <Input value={form.phone} onChange={set("phone")} placeholder="+91 98765 43210" />
            </label>
            {error ? <p role="alert" className="t-callout text-danger">{error}</p> : null}
            <DialogFooter>
              <Button type="button" variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit" loading={pending} disabled={form.name.trim().length < 2}>Add</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
