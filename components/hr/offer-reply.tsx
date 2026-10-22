"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"

/** Accept or decline, each behind a confirm step. The answer is final, so the page says so. */
export function OfferReply({ token, initial }: { token: string; initial: "accepted" | "declined" | null }) {
  const [answer, setAnswer] = React.useState(initial)
  const [pick, setPick] = React.useState<null | "accepted" | "declined">(null)
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  async function send(response: "accepted" | "declined") {
    if (busy) return
    setBusy(true)
    setError(null)
    try {
      const res = await fetch(`/api/o/${token}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ response }) })
      const json = (await res.json().catch(() => null)) as { error?: { message?: string } } | null
      if (res.ok || res.status === 409) { setAnswer(res.ok ? response : answer ?? response); if (!res.ok) setError(json?.error?.message ?? null) }
      else setError(json?.error?.message ?? "Couldn't save your answer. Try again.")
    } catch {
      setError("Couldn't reach the server. Check your connection and try again.")
    }
    setBusy(false)
  }

  if (answer) {
    return (
      <div role="status" className="rounded-group bg-mist p-5">
        <p className="t-headline text-ink">{answer === "accepted" ? "You accepted this offer." : "You declined this offer."}</p>
        <p className="t-callout mt-1 text-ink-2">{answer === "accepted" ? "Thank you. The hiring team has been told and will be in touch with the next steps." : "Thank you for letting us know. The hiring team has been told."}</p>
      </div>
    )
  }
  return (
    <div>
      {pick ? (
        <div className="rounded-group bg-mist p-5">
          <p className="t-body text-ink">{pick === "accepted" ? "Accept this offer? This is final." : "Decline this offer? This is final."}</p>
          <div className="mt-3 flex gap-2">
            <Button loading={busy} onClick={() => void send(pick)}>{pick === "accepted" ? "Yes, accept" : "Yes, decline"}</Button>
            <Button variant="secondary" onClick={() => setPick(null)}>Go back</Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-3">
          <Button className="h-12 px-8" onClick={() => setPick("accepted")}>Accept the offer</Button>
          <Button variant="secondary" className="h-12 px-8" onClick={() => setPick("declined")}>Decline</Button>
        </div>
      )}
      {error ? <p role="alert" className="t-callout mt-3 text-danger">{error}</p> : null}
    </div>
  )
}
