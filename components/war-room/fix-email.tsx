"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { toast } from "@/components/ui/toaster"
import type { LiveInvitation } from "@/lib/db/queries/live"

async function call(url: string, method: string, body?: unknown): Promise<string | null> {
  try {
    const res = await fetch(url, { method, headers: { "content-type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) })
    if (res.ok) return null
    const json = (await res.json().catch(() => null)) as { error?: { message?: string } } | null
    return json?.error?.message ?? "Something went wrong. Try again."
  } catch {
    return "Couldn't reach the server. Check your connection and retry."
  }
}

/** Shown when an invitation email bounced: correct the address and send the same link again, in one step. */
export function FixEmail({ invitation }: { invitation: LiveInvitation }) {
  const [value, setValue] = React.useState(invitation.email ?? "")
  const [pending, setPending] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  async function resend(e: React.FormEvent) {
    e.preventDefault()
    if (pending) return
    setPending(true)
    setError(null)
    const next = value.trim()
    if (next.toLowerCase() !== (invitation.email ?? "").toLowerCase()) {
      const failed = await call(`/api/candidates/${invitation.candidate_id}`, "PATCH", { email: next })
      if (failed) { setPending(false); return setError(failed) }
    }
    const failed = await call(`/api/invitations/${invitation.id}/resend`, "POST")
    setPending(false)
    if (failed) return setError(failed)
    toast(`Sent the link again to ${next}`)
  }

  return (
    <form onSubmit={(e) => void resend(e)} className="flex flex-col gap-1.5 rounded-control bg-danger-tint px-3 py-2.5">
      <p className="t-footnote text-danger">{invitation.delivery_error ?? "The email didn't arrive."} Check the spelling, then send again.</p>
      <div className="flex items-center gap-2">
        <Input type="email" aria-label={`Corrected email for ${invitation.name}`} value={value} onChange={(e) => setValue(e.target.value)} className="h-9 min-w-0 flex-1 bg-canvas text-[15px]" />
        <Button type="submit" size="sm" variant="secondary" loading={pending} disabled={!value.trim()}>Send again</Button>
      </div>
      {error ? <p role="alert" className="t-footnote text-danger">{error}</p> : null}
    </form>
  )
}
