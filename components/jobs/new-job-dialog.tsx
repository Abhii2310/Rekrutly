"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "@/components/ui/toaster"

/** Creates a role. Skills are typed separated by commas. */
export function NewJobDialog() {
  const router = useRouter()
  const [open, setOpen] = React.useState(false)
  const [pending, setPending] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [f, setF] = React.useState({ title: "", team: "", location: "", skills: "", description: "" })
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF((p) => ({ ...p, [k]: e.target.value }))

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (pending) return
    setPending(true)
    setError(null)
    try {
      const res = await fetch("/api/jobs", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ title: f.title, team: f.team, location: f.location, description: f.description, skills: f.skills.split(",").map((s) => s.trim()).filter(Boolean) }),
      })
      const body = (await res.json().catch(() => null)) as { data?: { id: string }; error?: { message?: string } } | null
      if (res.ok && body?.data) {
        toast("Role created")
        setOpen(false)
        router.push(`/jobs/${body.data.id}`)
        return
      }
      setError(body?.error?.message ?? "Couldn't create the role. Try again.")
    } catch {
      setError("Couldn't reach the server. Check your connection and try again.")
    }
    setPending(false)
  }

  return (
    <>
      <Button onClick={() => setOpen(true)}>New role</Button>
      <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) { setError(null); setPending(false) } }}>
        <DialogContent>
          <form onSubmit={submit} className="flex flex-col gap-4">
            <DialogHeader>
              <DialogTitle>New role</DialogTitle>
              <DialogDescription>Add the role first, then import candidates from a CSV or ask Rekrutly to create an assessment.</DialogDescription>
            </DialogHeader>
            <Input aria-label="Role title" placeholder="Role title, for example Data Analyst" value={f.title} onChange={set("title")} autoFocus />
            <div className="grid grid-cols-2 gap-3">
              <Input aria-label="Team" placeholder="Team" value={f.team} onChange={set("team")} />
              <Input aria-label="Location" placeholder="Location" value={f.location} onChange={set("location")} />
            </div>
            <Input aria-label="Skills" placeholder="Skills, separated by commas" value={f.skills} onChange={set("skills")} />
            <Textarea aria-label="Description" placeholder="What the person will do (optional)" value={f.description} onChange={set("description")} />
            {error ? <p role="alert" className="t-callout text-danger">{error}</p> : null}
            <DialogFooter>
              <Button type="button" variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit" loading={pending} disabled={f.title.trim().length < 2}>Create role</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
