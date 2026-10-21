"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import { GroupedList, ListRow } from "@/components/ui/grouped-list"
import { Pill } from "@/components/ui/status-pill"

type Result =
  | { tier: string; ok: true; provider: string; model: string; ms: number; fellBack: boolean }
  | { tier: string; ok: false; error: string }

const TIER = { smart: "Planning, questions and reports", fast: "Grading and follow-up drafts" } as const

/** Runs one tiny real call on each model tier and shows which provider answered and how long it took. */
export function AiCheck() {
  const [pending, setPending] = React.useState(false)
  const [results, setResults] = React.useState<Result[] | null>(null)
  const [error, setError] = React.useState<string | null>(null)

  async function run() {
    setPending(true)
    setError(null)
    try {
      const res = await fetch("/api/system/ai-check", { method: "POST" })
      const body = (await res.json().catch(() => null)) as { data?: { results: Result[] }; error?: { message?: string } } | null
      if (res.ok && body?.data) setResults(body.data.results)
      else setError(body?.error?.message ?? "The check couldn't run. Try again.")
    } catch {
      setError("Couldn't reach the server. Check your connection and try again.")
    }
    setPending(false)
  }

  return (
    <div>
      <Button variant="secondary" loading={pending} onClick={() => void run()}>Test the AI</Button>
      <p className="t-callout mt-2 text-ink-2">Sends two tiny test requests. No candidate data is used.</p>
      {error ? <p role="alert" className="t-callout mt-3 text-danger">{error}</p> : null}
      {results ? (
        <div className="mt-4" aria-live="polite">
          <GroupedList>
            {results.map((r) => (
              <ListRow
                key={r.tier}
                title={TIER[r.tier as keyof typeof TIER] ?? r.tier}
                subtitle={r.ok ? `${r.provider}, ${r.model}${r.fellBack ? ", backup provider used" : ""}` : r.error}
                value={r.ok ? `${(r.ms / 1000).toFixed(1)} s` : undefined}
                pill={<Pill tone={r.ok ? "success" : "danger"}>{r.ok ? "Working" : "Failed"}</Pill>}
              />
            ))}
          </GroupedList>
        </div>
      ) : null}
    </div>
  )
}
