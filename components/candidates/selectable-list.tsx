"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ChevronRight, Star } from "lucide-react"
import { cn } from "cn"
import { Avatar } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { StatusPill } from "@/components/ui/status-pill"
import type { Stage } from "@/lib/status"

export type SelectableRow = {
  id: string; jobId: string; jobTitle: string | null; name: string; subtitle: string | null; stage: Stage; href: string
  /** Resume match percent, if scored. Shortlisted, interview and offer are the recruiter's own markers. */
  match: number | null; shortlisted: boolean; interview: boolean; offer: boolean
}

/**
 * The candidate list with tick boxes. Tick people from one role, then Create assessment opens the Command Centre with
 * only those people. Nothing is sent from here.
 */
export function SelectableCandidates({ rows: all }: { rows: SelectableRow[] }) {
  const router = useRouter()
  const [picked, setPicked] = React.useState<string[]>([])
  const [byMatch, setByMatch] = React.useState(false)
  const [onlyShort, setOnlyShort] = React.useState(false)
  const anyScored = all.some((r) => r.match !== null)
  const anyShort = all.some((r) => r.shortlisted)
  const rows = React.useMemo(() => {
    const list = onlyShort ? all.filter((r) => r.shortlisted) : all
    return byMatch ? [...list].sort((a, b) => (b.match ?? -1) - (a.match ?? -1)) : list
  }, [all, byMatch, onlyShort])
  const jobOf = rows.find((r) => r.id === picked[0])?.jobId ?? null
  const jobTitle = rows.find((r) => r.id === picked[0])?.jobTitle ?? "this role"
  const jobs = new Set(rows.map((r) => r.jobId))
  const single = jobs.size === 1

  const toggle = (id: string) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]))
  const allInJob = (job: string) => rows.filter((r) => r.jobId === job).map((r) => r.id)
  const everyoneTicked = single && picked.length === rows.length

  function create() {
    if (!jobOf || picked.length === 0) return
    const q = `Prepare a 30-minute assessment for the ${picked.length} ${picked.length === 1 ? "person" : "people"} I selected for ${jobTitle}. Show me the questions before inviting anyone.`
    router.push(`/command?${new URLSearchParams({ job: jobOf, ids: picked.join(","), q }).toString()}`)
  }

  return (
    <>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        {single ? (
          <label className="t-callout flex min-h-9 cursor-pointer items-center gap-2.5 text-ink-2">
            <input type="checkbox" checked={everyoneTicked} onChange={() => setPicked(everyoneTicked ? [] : allInJob([...jobs][0] as string))} className="focus-ring size-4 accent-[var(--color-action)]" />
            Select everyone shown ({rows.length})
          </label>
        ) : (
          <p className="t-callout text-ink-2">Tick people from one role to create an assessment for them.</p>
        )}
        <span className="flex items-center gap-4">
          {anyScored ? <button type="button" aria-pressed={byMatch} onClick={() => setByMatch((v) => !v)} className={cn("focus-ring t-callout rounded hover:text-action-hover", byMatch ? "text-ink" : "text-action")}>{byMatch ? "Sorted by resume match" : "Sort by resume match"}</button> : null}
          {anyShort ? <button type="button" aria-pressed={onlyShort} onClick={() => setOnlyShort((v) => !v)} className={cn("focus-ring t-callout rounded hover:text-action-hover", onlyShort ? "text-ink" : "text-action")}>{onlyShort ? "Shortlisted only" : "Show shortlisted only"}</button> : null}
          {picked.length > 0 ? <button type="button" onClick={() => setPicked([])} className="focus-ring t-callout rounded text-action hover:text-action-hover">Clear selection</button> : null}
        </span>
      </div>

      <div className="rounded-group bg-mist p-1">
        <ul className="overflow-hidden rounded-[10px] bg-canvas">
          {rows.map((r) => {
            const blocked = jobOf !== null && r.jobId !== jobOf
            return (
              <li key={r.id} className="relative list-none after:absolute after:bottom-0 after:left-4 after:right-0 after:h-px after:bg-hairline/70 last:after:hidden">
                <div className={cn("flex min-h-14 items-center gap-3 px-4 py-2 transition-colors hover:bg-mist/60", picked.includes(r.id) && "bg-action-tint/50")}>
                  <input
                    type="checkbox" aria-label={`Select ${r.name}`} checked={picked.includes(r.id)} disabled={blocked} onChange={() => toggle(r.id)}
                    title={blocked ? "Finish with the selected role first. An assessment is for one role." : undefined}
                    className="focus-ring size-5 shrink-0 accent-[var(--color-action)] disabled:opacity-30"
                  />
                  <Link href={r.href} className="focus-ring flex min-w-0 flex-1 items-center gap-3 rounded text-left">
                    <Avatar name={r.name} />
                    <span className="min-w-0 flex-1">
                      <span className="t-headline block truncate text-ink">{r.name}</span>
                      {r.subtitle ? <span className="t-callout block truncate text-ink-2">{r.subtitle}</span> : null}
                    </span>
                    {r.jobTitle ? <span className="t-callout tabular hidden shrink-0 text-ink-2 sm:block">{r.jobTitle}</span> : null}
                    {r.shortlisted ? <Star aria-label="Shortlisted" className="size-4 shrink-0 fill-current text-warning" strokeWidth={1.5} /> : null}
                    {r.match !== null ? <span className="t-footnote tabular shrink-0 rounded-full bg-fog px-2 py-0.5 text-ink" title="Resume match, suggested by AI. A help for looking, never a decision.">Match {r.match}%</span> : null}
                    {r.interview ? <span className="t-footnote hidden shrink-0 text-ink-2 md:block">Interview set</span> : null}
                    {r.offer ? <span className="t-footnote hidden shrink-0 text-ink-2 md:block">Offer drafted</span> : null}
                    <span className="shrink-0"><StatusPill kind="candidate" value={r.stage} /></span>
                    <ChevronRight aria-hidden className="size-4 shrink-0 text-ink-3" strokeWidth={1.75} />
                  </Link>
                </div>
              </li>
            )
          })}
        </ul>
      </div>

      {picked.length > 0 ? (
        <div className="sticky bottom-4 z-10 mt-6 flex justify-center px-2" role="region" aria-label="Selection">
          <div className="flex w-full max-w-[560px] flex-wrap items-center justify-between gap-3 rounded-[22px] bg-ink px-5 py-3 text-canvas shadow-lg">
            <span className="t-callout">{picked.length} selected for {jobTitle}</span>
            <span className="flex items-center gap-2">
              <button type="button" onClick={() => setPicked([])} className="focus-ring t-callout rounded px-2 text-canvas/80 hover:text-canvas">Clear</button>
              <Button size="sm" className="bg-canvas text-ink hover:bg-fog" onClick={create}>Create assessment</Button>
            </span>
          </div>
        </div>
      ) : null}
    </>
  )
}
