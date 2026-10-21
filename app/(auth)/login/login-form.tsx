"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

export function LoginForm({ next }: { next: string }) {
  const router = useRouter()
  const [passcode, setPasscode] = React.useState("")
  const [error, setError] = React.useState<string | null>(null)
  const [pending, setPending] = React.useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (pending || !passcode) return
    setPending(true)
    setError(null)
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ passcode }),
      })
      if (res.ok) {
        router.replace(next)
        router.refresh()
        return
      }
      const body = (await res.json().catch(() => null)) as { error?: { message?: string } } | null
      setError(body?.error?.message ?? "Couldn't sign in. Try again.")
    } catch {
      setError("Couldn't reach the server. Check your connection and try again.")
    }
    setPending(false)
  }

  return (
    <form onSubmit={submit} className="mt-8 flex flex-col gap-4">
      <Input
        type="password"
        aria-label="Passcode"
        placeholder="Passcode"
        autoComplete="current-password"
        autoFocus
        value={passcode}
        onChange={(e) => setPasscode(e.target.value)}
        aria-invalid={error ? true : undefined}
      />
      {error ? <p role="alert" className="t-callout text-danger">{error}</p> : null}
      <Button type="submit" loading={pending} disabled={!passcode} className="w-full">
        Sign in
      </Button>
    </form>
  )
}
