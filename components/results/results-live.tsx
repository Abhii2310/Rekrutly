"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { AIMark } from "@/components/ui/ai-mark"
import { Pill } from "@/components/ui/status-pill"
import { usePoll } from "@/hooks/use-poll"
import type { AssessmentResults } from "@/lib/db/queries/results"
import { Stat } from "@/components/ui/stat"

const pct = (n: number | null): string => (n === null ? "–" : `${n}%`)

function Cols({ objective, ai, final }: { objective: string; ai: string; final: string }) {
  return (
    <span className="t-callout tabular grid shrink-0 grid-cols-3 gap-4 text-right sm:w-[260px]">
      <span className="text-ink-2">{objective}</span>
      <span className="text-ink-2">{ai}</span>
      <span className="font-medium text-ink">{final}</span>
    </span>
  )
}

/** The candidates of one assessment, updating every 2 seconds while the tab is visible. */
export function ResultsLive({ assessmentId, initial }: { assessmentId: string; initial: AssessmentResults }) {
  const { data = initial, reconnecting } = usePoll<AssessmentResults>(`/api/assessments/${assessmentId}/live`, { initial })
  const router = useRouter()
  // The order of choosing is the order of the columns on the Compare page. Nothing is sorted or ranked.
  const [picked, setPicked] = React.useState<string[]>([])
  const canPick = (r: AssessmentResults["rows"][number]) => Boolean(r.submissionId)
  function toggle(id: string, on: boolean) {
    setPicked((p) => (on ? (p.includes(id) || p.length >= 4 ? p : [...p, id]) : p.filter((x) => x !== id)))
  }

  return (
    <div>
      <div className="grid grid-cols-2 gap-x-6 gap-y-6 sm:grid-cols-4">
        <Stat value={data.counts.invited} label="Invited" />
        <Stat value={data.counts.started} label="Started" />
        <Stat value={data.counts.submitted} label="Submitted" />
        <Stat value={data.counts.ready} label="Reports ready" />
      </div>

      <div className="mt-10">
        {data.rows.some(canPick) ? (
          <div className="mb-3 flex items-center justify-between gap-3">
            <p className="t-callout text-ink-2">{picked.length < 2 ? "Tick two to four candidates to compare their evidence side by side." : `${picked.length} chosen.`}</p>
            <Button variant="secondary" size="sm" disabled={picked.length < 2} onClick={() => router.push(`/compare?s=${picked.join(",")}`)}>Compare</Button>
          </div>
        ) : null}
        <div className="t-callout hidden items-center gap-3 px-5 pb-2 text-ink-2 sm:flex">
          <span className="flex-1 pl-8">Candidate</span>
          <span className="w-[110px]" />
          <span className="grid w-[260px] grid-cols-3 gap-4 text-right">
            <span>Objective</span>
            <span className="inline-flex justify-end"><AIMark label="Written" /></span>
            <span>Final</span>
          </span>
          <span className="w-4" />
        </div>
        <div className="rounded-group bg-mist p-1">
          <ul className="overflow-hidden rounded-[10px] bg-canvas">
            {data.rows.map((r) => {
              const body = (
                <>
                  <span className="t-headline min-w-0 flex-1 truncate text-ink">{r.name}</span>
                  <span className="w-[110px] shrink-0 text-right sm:text-left"><Pill tone={r.state.tone}>{r.state.label}</Pill></span>
                  <Cols objective={pct(r.objectivePct)} ai={pct(r.aiPct)} final={pct(r.finalPct)} />
                  {r.submissionId ? <ChevronRight aria-hidden className="size-4 shrink-0 text-ink-3" strokeWidth={1.75} /> : <span className="w-4 shrink-0" />}
                </>
              )
              const cls = "focus-ring flex min-h-14 min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-1 py-2 pr-4 text-left sm:flex-nowrap sm:pr-5"
              const id = r.submissionId
              const checked = id !== null && picked.includes(id)
              return (
                <li key={r.invitationId} className="relative flex list-none items-center after:absolute after:bottom-0 after:left-4 after:right-0 after:h-px after:bg-hairline/70 last:after:hidden">
                  <span className="flex w-12 shrink-0 justify-center pl-2">
                    {id ? (
                      <input
                        type="checkbox" aria-label={`Compare ${r.name}`} checked={checked} disabled={!checked && picked.length >= 4}
                        onChange={(e) => toggle(id, e.target.checked)}
                        className="focus-ring size-4 accent-[var(--color-action)]"
                      />
                    ) : null}
                  </span>
                  {id ? <Link href={`/submissions/${id}`} className={`${cls} transition-colors hover:bg-mist/60`}>{body}</Link> : <div className={cls}>{body}</div>}
                </li>
              )
            })}
          </ul>
        </div>
        <p className="t-callout mt-3 text-ink-2">Percentages are shares of the points available. Written scores are AI suggestions until you review them.</p>
        {reconnecting ? <p className="t-callout mt-2 text-ink-2" aria-live="polite">Reconnecting…</p> : null}
      </div>
    </div>
  )
}
