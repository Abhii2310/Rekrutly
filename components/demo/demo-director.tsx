"use client"

import * as React from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { GroupedList, ListRow } from "@/components/ui/grouped-list"
import { Pill, StatusPill } from "@/components/ui/status-pill"
import { Section } from "@/components/ui/section"
import { toast } from "@/components/ui/toaster"
import type { InvitationStatus } from "@/lib/status"

type Status = {
  health: { db: "ok" | "error"; ai: { provider: string; fallback: string | null }; email: "configured" | "not_configured" | "test_sender_without_recipient" }
  assessment: { id: string; title: string; runId: string | null } | null
  invitations: { id: string; candidateId: string; name: string; status: InvitationStatus; submissionId: string | null; scoring: string | null; report: string | null }[]
}
type Row = { id: string; name: string; state: "waiting" | "running" | "done" | "failed"; message?: string }

const AARAV = "22222222-2222-4222-8222-000000000001"
const EMAIL: Record<Status["health"]["email"], string> = {
  configured: "Ready", not_configured: "Not set up. Links are shared by hand.", test_sender_without_recipient: "Test sender only. Add DEMO_CANDIDATE_EMAIL.",
}
// 8 to 12 seconds between candidates, varied so it looks like different people.
const GAPS_MS = [9000, 11500, 8000, 12000, 10000]
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))
const startable = (s: InvitationStatus) => s === "created" || s === "sent" || s === "opened"

async function api<T>(url: string, init?: RequestInit): Promise<{ ok: true; data: T } | { ok: false; message: string }> {
  try {
    const res = await fetch(url, { cache: "no-store", ...init, headers: { "content-type": "application/json" } })
    const json = (await res.json().catch(() => null)) as { data?: T; error?: { message?: string } } | null
    if (res.ok && json?.data !== undefined) return { ok: true, data: json.data }
    return { ok: false, message: json?.error?.message ?? "Something went wrong. Try again." }
  } catch {
    return { ok: false, message: "Couldn't reach the server. Check your connection and retry." }
  }
}

export function DemoDirector() {
  const [status, setStatus] = React.useState<Status | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const [chosen, setChosen] = React.useState<ReadonlySet<string> | null>(null)
  const [rows, setRows] = React.useState<Row[]>([])
  const [running, setRunning] = React.useState(false)
  const [resetOpen, setResetOpen] = React.useState(false)
  const [resetting, setResetting] = React.useState(false)
  const [resetNote, setResetNote] = React.useState<string | null>(null)
  const [history, setHistory] = React.useState(false)
  const stop = React.useRef(false)

  const load = React.useCallback(async () => {
    const res = await api<Status>("/api/demo/status")
    if (res.ok) { setStatus(res.data); setError(null) } else setError(res.message)
    return res.ok ? res.data : null
  }, [])

  React.useEffect(() => {
    let alive = true
    void api<Status>("/api/demo/status").then((res) => {
      if (!alive) return
      if (res.ok) setStatus(res.data)
      else setError(res.message)
    })
    return () => { alive = false }
  }, [])
  // While a simulation runs the candidate statuses change, so keep them fresh.
  React.useEffect(() => {
    if (!running) return
    const t = setInterval(() => void load(), 3000)
    return () => clearInterval(t)
  }, [running, load])

  // Default: everyone who can start, except Aarav, the one you will take live.
  const picked = chosen ?? new Set((status?.invitations ?? []).filter((i) => startable(i.status) && i.candidateId !== AARAV).map((i) => i.id))
  const setRow = (id: string, patch: Partial<Row>) => setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)))

  async function start() {
    if (!status) return
    const todo = status.invitations.filter((i) => picked.has(i.id) && startable(i.status))
    if (todo.length === 0) return toast("Choose at least one candidate who hasn't started.")
    stop.current = false
    setRunning(true)
    setRows(todo.map((i) => ({ id: i.id, name: i.name, state: "waiting" })))
    const inFlight: Promise<void>[] = []
    for (let n = 0; n < todo.length; n++) {
      const i = todo[n]
      if (!i || stop.current) break
      setRow(i.id, { state: "running" })
      // Not awaited: each candidate takes a while to answer, and the next one starts 8 to 12 seconds later.
      inFlight.push(api<{ candidate: string }>("/api/demo/simulate", { method: "POST", body: JSON.stringify({ invitationId: i.id }) }).then((r) => {
        setRow(i.id, r.ok ? { state: "done", message: "Submitted. Scoring and the report are running." } : { state: "failed", message: r.message })
      }))
      if (n < todo.length - 1) await sleep(GAPS_MS[n % GAPS_MS.length] ?? 10000)
    }
    await Promise.all(inFlight)
    await settleReports(todo.map((i) => i.id))
    setRunning(false)
    await load()
    toast(stop.current ? "Stopped" : "Simulation finished")
  }

  /**
   * Scoring and reports run in the background and the free AI tier sometimes answers "rate limited". Wait for them, and
   * retry a failed one (the same Retry button a recruiter has), a few times with pauses, so every candidate ends with a report.
   */
  async function settleReports(ids: string[]) {
    for (let round = 0; round < 4 && !stop.current; round++) {
      const s = await load()
      const mine = (s?.invitations ?? []).filter((i) => ids.includes(i.id))
      const failed = mine.filter((i) => i.submissionId && (i.scoring === "failed" || i.report === "failed"))
      const waiting = mine.filter((i) => i.status === "submitted" && i.report !== "ready" && !failed.includes(i))
      for (const i of mine) setRow(i.id, { message: i.report === "ready" ? "Report ready." : failed.includes(i) ? "Scoring hit a limit. Retrying…" : "Scoring and writing the report…" })
      if (failed.length === 0 && waiting.length === 0) return
      for (const f of failed) {
        await api(`/api/submissions/${f.submissionId}/rescore`, { method: "POST" })
        await sleep(15000)
      }
      await sleep(failed.length ? 5000 : 12000)
    }
  }

  async function reset() {
    setResetting(true)
    const res = await api<{ jobs: number; candidates: number }>("/api/demo/reset", { method: "POST" })
    setResetting(false)
    setResetOpen(false)
    if (!res.ok) return toast(res.message)
    setRows([]); setChosen(null)
    setResetNote(`Reset done: ${res.data.jobs} jobs and ${res.data.candidates} candidates recreated.`)
    toast("Demo data reset")
    await load()
  }

  async function seedHistory() {
    setHistory(true)
    const res = await api<{ submissions: number }>("/api/demo/history", { method: "POST" })
    setHistory(false)
    toast(res.ok ? `Added history: ${res.data.submissions} simulated submissions` : res.message)
  }

  async function openAarav() {
    const inv = status?.invitations.find((i) => i.candidateId === AARAV)
    if (!inv) return toast("Aarav has no link yet. Approve a workflow first.")
    const tab = window.open("", "_blank") // opened first so the browser doesn't block it
    const res = await api<{ url: string }>(`/api/invitations/${inv.id}/link`)
    if (res.ok && tab) tab.location.href = res.data.url
    else { tab?.close(); toast(res.ok ? "Couldn't open the link." : res.message) }
  }

  if (!status) {
    return error
      ? <div role="alert" className="max-w-[720px]"><p className="t-headline text-ink">{error}</p><div className="mt-4"><Button variant="secondary" onClick={() => void load()}>Retry</Button></div></div>
      : <p className="t-body text-ink-2" role="status">Loading…</p>
  }

  const links = status.invitations.length
  return (
    <div className="max-w-[720px]">
      <Section title="Demo checklist" className="mt-0">
        <GroupedList>
          <ListRow title="Database" pill={<Pill tone={status.health.db === "ok" ? "success" : "danger"}>{status.health.db === "ok" ? "Connected" : "Not reachable"}</Pill>} />
          <ListRow title="AI" subtitle={status.health.ai.fallback ? `${status.health.ai.provider}, backup: ${status.health.ai.fallback}` : status.health.ai.provider} pill={<Pill tone="success">Configured</Pill>} />
          <ListRow title="Email" subtitle={EMAIL[status.health.email]} pill={<Pill tone={status.health.email === "configured" ? "success" : "neutral"}>{status.health.email === "configured" ? "Ready" : "Optional"}</Pill>} />
          <ListRow title="Live candidate links" subtitle={status.assessment ? status.assessment.title : "No live assessment yet"} value={links} />
        </GroupedList>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Button asChild variant="secondary"><Link href="/command">Open the Command Centre</Link></Button>
          <Button variant="secondary" onClick={() => void openAarav()} disabled={!status.invitations.some((i) => i.candidateId === AARAV)}>Open Aarav&apos;s candidate link</Button>
          {status.assessment?.runId ? <Button asChild variant="plain"><Link href={`/runs/${status.assessment.runId}/war-room`}>Open the War Room</Link></Button> : null}
        </div>
      </Section>

      <Section title="Simulate submissions">
        {!status.assessment ? (
          <p className="t-body text-ink-2">There is no live assessment yet. Plan and approve one in the Command Centre first.</p>
        ) : (
          <>
            <p className="t-callout mb-3 text-ink-2">
              Candidates answer one at a time through the real test, 8 to 12 seconds apart, so the War Room fills in gradually. Strong in the skills on their profile, weaker elsewhere. Everything is labelled Simulated. The one you will take live is left unticked.
            </p>
            <div className="rounded-group bg-mist p-1">
              <ul className="overflow-hidden rounded-[10px] bg-canvas">
                {status.invitations.map((i) => {
                  const can = startable(i.status)
                  const row = rows.find((r) => r.id === i.id)
                  return (
                    <li key={i.id} className="relative flex min-h-14 list-none items-center gap-3 px-4 py-2 after:absolute after:bottom-0 after:left-4 after:right-0 after:h-px after:bg-hairline/70 last:after:hidden">
                      <input
                        id={`sim-${i.id}`} type="checkbox" disabled={!can || running} checked={can && picked.has(i.id)}
                        onChange={(e) => setChosen((prev) => { const n = new Set(prev ?? picked); if (e.target.checked) n.add(i.id); else n.delete(i.id); return n })}
                        className="focus-ring size-4 shrink-0 accent-[var(--color-action)]"
                      />
                      <label htmlFor={`sim-${i.id}`} className="min-w-0 flex-1">
                        <span className="t-headline block truncate text-ink">{i.name}</span>
                        {row?.message ? <span className="t-callout block text-ink-2">{row.message}</span> : null}
                      </label>
                      {row ? <span className="t-callout shrink-0 text-ink-2">{{ waiting: "Waiting", running: "Answering…", done: "Done", failed: "Failed" }[row.state]}</span> : null}
                      <StatusPill kind="invitation" value={i.status} />
                    </li>
                  )
                })}
              </ul>
            </div>
            <div className="mt-4 flex items-center gap-3">
              <Button loading={running} onClick={() => void start()}>Start</Button>
              {running ? <Button variant="secondary" onClick={() => { stop.current = true }}>Stop after this one</Button> : null}
            </div>
          </>
        )}
      </Section>

      <Section title="Seed history">
        <p className="t-callout mb-3 text-ink-2">Adds a closed assessment on the Backend Engineer (Go) job with 3 simulated submissions, so Analytics has history.</p>
        <Button variant="secondary" loading={history} onClick={() => void seedHistory()}>Seed history</Button>
      </Section>

      <Section title="Reset demo data">
        <p className="t-callout mb-3 text-ink-2">Starts the demo again from a clean slate.</p>
        <Button variant="secondary" onClick={() => setResetOpen(true)}>Reset demo data</Button>
        {resetNote ? <p role="status" className="t-callout mt-3 text-ink">{resetNote}</p> : null}
      </Section>

      <Dialog open={resetOpen} onOpenChange={setResetOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset the demo data?</DialogTitle>
            <DialogDescription>
              This deletes every demo run, assessment, invitation and submission, including ones you created by hand. Any exam link you have already emailed stops working, so candidates who click an old email will see \"This link isn't valid\". Never reset while real candidates are waiting. The seeded jobs and candidates are recreated with the same IDs, so saved fallbacks stay valid.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setResetOpen(false)}>Keep my data</Button>
            <Button variant="destructive" loading={resetting} onClick={() => void reset()}>Reset demo data</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
