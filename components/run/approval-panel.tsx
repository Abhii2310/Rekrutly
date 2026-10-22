"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Minus, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { toast } from "@/components/ui/toaster"
import { stepTitles } from "@/lib/executor/approval"
import { isReserved } from "@/lib/executor/email-plan"
import { firstNameOf, invitationText } from "@/lib/invitations/template"

export type Recipient = { id: string; name: string; email: string | null }

async function send(url: string, method: string, body?: unknown): Promise<string | null> {
  try {
    const res = await fetch(url, { method, headers: { "content-type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) })
    if (res.ok) return null
    const json = (await res.json().catch(() => null)) as { error?: { message?: string } } | null
    return json?.error?.message ?? "Something went wrong. Try again."
  } catch {
    return "Couldn't reach the server. Check your connection and retry."
  }
}

function EmailField({ candidate }: { candidate: Recipient }) {
  const router = useRouter()
  const [open, setOpen] = React.useState(false)
  const [value, setValue] = React.useState("")
  const [error, setError] = React.useState<string | null>(null)
  const [saving, setSaving] = React.useState(false)

  if (!open) {
    return (
      <span className="t-callout text-ink-2">
        {candidate.email ? "Demo address, link only." : "No email, link only."}{" "}
        <button type="button" onClick={() => setOpen(true)} className="focus-ring rounded text-action hover:text-action-hover">{candidate.email ? "Use a real email" : "Add email"}</button>
      </span>
    )
  }
  return (
    <form
      className="mt-2 flex flex-col gap-1.5"
      onSubmit={async (e) => {
        e.preventDefault()
        setSaving(true)
        setError(null)
        const message = await send(`/api/candidates/${candidate.id}`, "PATCH", { email: value.trim() })
        setSaving(false)
        if (message) return setError(message)
        toast("Email added")
        router.refresh()
      }}
    >
      <div className="flex items-center gap-2">
        <Input type="email" aria-label={`Email for ${candidate.name}`} value={value} onChange={(e) => setValue(e.target.value)} placeholder="name@example.com" className="h-9" autoFocus />
        <Button type="submit" size="sm" variant="secondary" loading={saving} disabled={!value.trim()}>Save</Button>
      </div>
      {error ? <p role="alert" className="t-callout text-danger">{error}</p> : null}
    </form>
  )
}

/** The right-hand summary on the review screen. This is where a person approves. */
export function ApprovalPanel({
  runId, roleTitle, initialMinutes, recipients, questionCount,
}: { runId: string; roleTitle: string; initialMinutes: number; recipients: Recipient[]; questionCount: number }) {
  const router = useRouter()
  const [minutes, setMinutes] = React.useState(initialMinutes)
  const [chosen, setChosen] = React.useState<Set<string>>(() => new Set(recipients.map((r) => r.id)))
  const [pending, setPending] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [cancelOpen, setCancelOpen] = React.useState(false)
  const [cancelling, setCancelling] = React.useState(false)
  const [showFull, setShowFull] = React.useState(false)
  const [proctored, setProctored] = React.useState(false)
  const [aiInterview, setAiInterview] = React.useState(false)

  const picked = recipients.filter((r) => chosen.has(r.id))
  const withEmail = picked.filter((r) => r.email).length
  const titles = stepTitles(picked.length, withEmail)
  const preview = invitationText({ firstName: picked[0] ? firstNameOf(picked[0].name) : "there", role: roleTitle, durationMinutes: minutes, proctored, aiInterview })

  async function approve() {
    if (pending || picked.length === 0) return
    setPending(true)
    setError(null)
    const message = await send(`/api/runs/${runId}/approve`, "POST", { durationMinutes: minutes, proctored, aiInterview, recipientIds: picked.map((r) => r.id) })
    if (message) {
      setPending(false)
      return setError(message)
    }
    toast("Approved")
    router.refresh()
  }

  async function cancel() {
    setCancelling(true)
    const message = await send(`/api/runs/${runId}/cancel`, "POST")
    setCancelling(false)
    if (message) return toast(message)
    setCancelOpen(false)
    toast("Cancelled")
    router.refresh()
  }

  return (
    <aside aria-label="Approve this workflow" className="flex max-h-[calc(100vh-9rem)] flex-col rounded-group bg-mist">
      <div className="flex flex-col gap-6 overflow-y-auto p-5">
      <section>
        <h3 className="t-headline text-ink">Time limit</h3>
        <div className="mt-2 flex items-center gap-3">
          <button type="button" aria-label="Shorter by 5 minutes" disabled={minutes <= 10} onClick={() => setMinutes((m) => Math.max(10, m - 5))}
            className="focus-ring inline-flex size-9 items-center justify-center rounded-full bg-fog text-ink transition-colors hover:bg-hairline disabled:opacity-40">
            <Minus aria-hidden className="size-4" strokeWidth={1.75} />
          </button>
          <span className="t-body tabular min-w-[96px] text-center text-ink" aria-live="polite">{minutes} minutes</span>
          <button type="button" aria-label="Longer by 5 minutes" disabled={minutes >= 120} onClick={() => setMinutes((m) => Math.min(120, m + 5))}
            className="focus-ring inline-flex size-9 items-center justify-center rounded-full bg-fog text-ink transition-colors hover:bg-hairline disabled:opacity-40">
            <Plus aria-hidden className="size-4" strokeWidth={1.75} />
          </button>
        </div>
      </section>

      <section>
        <h3 className="t-headline text-ink">Who gets a link</h3>
        <ul className="mt-2 flex flex-col gap-3">
          {recipients.map((r) => (
            <li key={r.id}>
              <label className="flex cursor-pointer items-start gap-3">
                <input
                  type="checkbox" checked={chosen.has(r.id)} className="focus-ring mt-1 size-4 shrink-0 accent-[var(--color-action)]"
                  onChange={(e) => setChosen((prev) => { const n = new Set(prev); if (e.target.checked) n.add(r.id); else n.delete(r.id); return n })}
                />
                <span className="min-w-0">
                  <span className="t-body block text-ink">{r.name}</span>
                  {r.email && !isReserved(r.email) ? <span className="t-callout block truncate text-ink-2">{r.email}</span> : null}
                </span>
              </label>
              {!r.email || isReserved(r.email) ? <div className="pl-7"><EmailField candidate={r} /></div> : null}
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h3 className="t-headline text-ink">Proctoring</h3>
        <label className="mt-2 flex cursor-pointer items-start gap-3">
          <input type="checkbox" checked={proctored} onChange={(e) => setProctored(e.target.checked)} className="focus-ring mt-1 size-4 shrink-0 accent-[var(--color-action)]" />
          <span className="min-w-0">
            <span className="t-body block text-ink">Record the candidate on camera</span>
            <span className="t-callout block text-ink-2">
              {proctored
                ? "Candidates see a clear consent screen and a camera check first. You get live alerts and a recording to review. Alerts are signals for you to look at, never proof, and nothing fails automatically."
                : "Off. Candidates are not recorded."}
            </span>
          </span>
        </label>
      </section>

      <section>
        <h3 className="t-headline text-ink">AI interview</h3>
        <label className="mt-2 flex cursor-pointer items-start gap-3">
          <input type="checkbox" checked={aiInterview} onChange={(e) => setAiInterview(e.target.checked)} className="focus-ring mt-1 size-4 shrink-0 accent-[var(--color-action)]" />
          <span className="min-w-0">
            <span className="t-body block text-ink">Add a talking AI interview after the test</span>
            <span className="t-callout block text-ink-2">
              {aiInterview
                ? "Right after the test, in the same link, an AI interviewer speaks four questions built from each person's own resume and test, and listens to their answers. You get a transcript and evidence notes with exact quotes, never a score."
                : "Off. The candidate finishes after the test."}
            </span>
          </span>
        </label>
      </section>

      <section>
        <h3 className="t-headline text-ink">Invitation</h3>
        <div className="mt-2 rounded-control bg-canvas p-4">
          <p className="t-callout font-medium text-ink">{preview.subject}</p>
          <p className={`t-callout mt-2 whitespace-pre-wrap text-ink-2 ${showFull ? "" : "line-clamp-3"}`}>{preview.body}</p>
          <button type="button" onClick={() => setShowFull((v) => !v)} aria-expanded={showFull} className="focus-ring t-callout mt-2 rounded text-action hover:text-action-hover">
            {showFull ? "Show less" : "Show full message"}
          </button>
        </div>
      </section>

      <section>
        <h3 className="t-headline text-ink">What happens next</h3>
        <ol className="t-callout mt-2 flex list-decimal flex-col gap-1 pl-5 text-ink-2">
          <li>Publish the assessment with its {questionCount} questions</li>
          <li>{titles.create_invitations}</li>
          <li>{titles.send_invitations}. Everyone else gets a link to copy.</li>
          <li>Track submissions as they arrive</li>
        </ol>
      </section>

      </div>

      <div className="flex flex-col items-start gap-2 border-t border-hairline/60 p-5">
        <Button className="w-full" loading={pending} disabled={picked.length === 0} onClick={approve}>Approve and create links</Button>
        {picked.length === 0 ? <p className="t-callout text-ink-2">Choose at least one candidate.</p> : null}
        {error ? <p role="alert" className="t-callout text-danger">{error}</p> : null}
        <Button variant="plain" onClick={() => setCancelOpen(true)}>Cancel</Button>
      </div>

      <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel this workflow?</DialogTitle>
            <DialogDescription>Nothing has been sent. You can start a new one from the Command Centre.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="plain" onClick={() => setCancelOpen(false)}>Keep it</Button>
            <Button variant="destructive" loading={cancelling} onClick={cancel}>Cancel workflow</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </aside>
  )
}
