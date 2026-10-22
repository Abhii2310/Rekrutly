"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { whenLabel } from "@/lib/interviews/rules"

/** The candidate chooses one of the offered times. One tap on a time, then a confirm. */
export function PickTime({ token, slots }: { token: string; slots: string[] }) {
  const router = useRouter()
  const [chosen, setChosen] = React.useState<string | null>(null)
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  async function confirm() {
    if (!chosen || busy) return
    setBusy(true)
    setError(null)
    try {
      const res = await fetch(`/api/i/${token}/pick`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ slot: chosen }) })
      const json = (await res.json().catch(() => null)) as { error?: { message?: string } } | null
      if (res.ok || res.status === 409) router.refresh()
      else setError(json?.error?.message ?? "Couldn't save your choice. Try again.")
    } catch {
      setError("Couldn't reach the server. Check your connection and try again.")
    }
    setBusy(false)
  }

  return (
    <div>
      <p className="t-body text-ink">Choose the time that suits you:</p>
      <ul className="mt-4 flex flex-col gap-2" role="radiogroup" aria-label="Interview times">
        {slots.map((s) => (
          <li key={s}>
            <button
              type="button" role="radio" aria-checked={chosen === s} onClick={() => setChosen(s)}
              className={`focus-ring t-body flex min-h-12 w-full items-center rounded-control px-4 text-left transition-colors ${chosen === s ? "bg-ink text-canvas" : "bg-mist text-ink hover:bg-fog"}`}
            >{whenLabel(new Date(s))}</button>
          </li>
        ))}
      </ul>
      {error ? <p role="alert" className="t-callout mt-3 text-danger">{error}</p> : null}
      <div className="mt-5"><Button className="h-12 px-8" loading={busy} disabled={!chosen} onClick={() => void confirm()}>Confirm this time</Button></div>
      <p className="t-callout mt-3 text-ink-2">You will get a confirmation email with the join link. If none of these work, reply to the email from the hiring team.</p>
    </div>
  )
}
