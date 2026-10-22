"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { MoreHorizontal, Star } from "lucide-react"
import { cn } from "cn"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { toast } from "@/components/ui/toaster"
import { BOARD_COLUMNS, checkDrop, columnOf, movableColumns, type BoardColumn } from "@/lib/board"
import type { Stage } from "@/lib/status"

export type BoardCard = { id: string; name: string; subtitle: string | null; jobTitle: string | null; stage: Stage; match: number | null; shortlisted: boolean; interview: boolean; offer: boolean }

async function moveTo(id: string, stage: Stage): Promise<string | null> {
  try {
    const res = await fetch(`/api/candidates/${id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ stage }) })
    if (res.ok) return null
    const json = (await res.json().catch(() => null)) as { error?: { message?: string } } | null
    return json?.error?.message ?? "Couldn't move them."
  } catch {
    return "Couldn't reach the server."
  }
}

/** The whole pipeline on one screen. Drag a card, or use its Move menu, to change the stage. Rekrutly-managed columns fill themselves. */
export function HiringBoard({ cards, showRole }: { cards: BoardCard[]; showRole: boolean }) {
  const router = useRouter()
  const [stages, setStages] = React.useState<Record<string, Stage>>({})
  const [drag, setDrag] = React.useState<string | null>(null)
  const [over, setOver] = React.useState<string | null>(null)
  const stageOf = (c: BoardCard): Stage => stages[c.id] ?? c.stage

  async function move(card: BoardCard, column: BoardColumn) {
    const check = checkDrop(stageOf(card), column)
    if (!check.ok) return toast(check.reason)
    const before = stageOf(card)
    setStages((s) => ({ ...s, [card.id]: check.to }))
    const failed = await moveTo(card.id, check.to)
    if (failed) { setStages((s) => ({ ...s, [card.id]: before })); return toast(failed) }
    toast(`${card.name} moved to ${column.label}`)
    router.refresh()
  }

  return (
    <div className="-mx-4 overflow-x-auto px-4 pb-6 md:-mx-6 md:px-6 lg:-mx-10 lg:px-10">
      <div className="flex min-w-max gap-4">
        {BOARD_COLUMNS.map((col) => {
          const inCol = cards.filter((c) => col.stages.includes(stageOf(c)))
          const target = drag ? cards.find((c) => c.id === drag) : null
          const droppable = target ? checkDrop(stageOf(target), col).ok : false
          return (
            <section
              key={col.key} aria-label={col.label}
              onDragOver={(e) => { if (drag) { e.preventDefault(); setOver(col.key) } }}
              onDragLeave={() => setOver((o) => (o === col.key ? null : o))}
              onDrop={(e) => { e.preventDefault(); setOver(null); const c = cards.find((x) => x.id === drag); setDrag(null); if (c) void move(c, col) }}
              className={cn("w-[250px] shrink-0 rounded-group bg-mist p-3 transition-colors", over === col.key && droppable && "bg-action-tint ring-2 ring-action/40", drag && !droppable && col.stages.every((s) => s !== (target ? stageOf(target) : "")) && "opacity-60")}
            >
              <div className="mb-3 flex items-baseline justify-between px-1">
                <h2 className="t-headline text-ink">{col.label}</h2>
                <span className="t-callout tabular text-ink-2">{inCol.length}</span>
              </div>
              <ul className="flex flex-col gap-2">
                {inCol.map((c) => {
                  const targets = movableColumns(stageOf(c))
                  return (
                    <li
                      key={c.id} draggable onDragStart={(e) => { setDrag(c.id); e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", c.id) }} onDragEnd={() => { setDrag(null); setOver(null) }}
                      className={cn("rounded-[12px] bg-canvas p-3 shadow-[0_1px_2px_rgba(0,0,0,0.06)]", drag === c.id && "opacity-40")}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <Link href={`/candidates?c=${c.id}`} className="focus-ring min-w-0 rounded">
                          <span className="t-headline block truncate text-ink">{c.name}</span>
                          <span className="t-footnote block truncate text-ink-2">{c.subtitle ?? ""}{showRole && c.jobTitle ? `${c.subtitle ? ", " : ""}${c.jobTitle}` : ""}</span>
                        </Link>
                        {targets.length > 0 ? (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button type="button" aria-label={`Move ${c.name}`} className="focus-ring -mr-1 -mt-1 flex size-8 shrink-0 items-center justify-center rounded-full text-ink-2 hover:bg-fog"><MoreHorizontal aria-hidden className="size-4" strokeWidth={1.75} /></button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              {targets.map((t) => <DropdownMenuItem key={t.key} onSelect={() => void move(c, t)}>Move to {t.label}</DropdownMenuItem>)}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        ) : null}
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-1.5">
                        {c.match !== null ? <span className="t-footnote tabular rounded-full bg-fog px-2 py-0.5 text-ink" title="Resume match, suggested by AI. A help for looking, never a decision.">Match {c.match}%</span> : null}
                        {c.shortlisted ? <span className="t-footnote inline-flex items-center gap-1 rounded-full bg-warning-tint px-2 py-0.5 text-ink"><Star aria-hidden className="size-3 fill-current text-warning" strokeWidth={1.5} />Shortlisted</span> : null}
                        {c.interview ? <span className="t-footnote rounded-full bg-action-tint px-2 py-0.5 text-action">Interview set</span> : null}
                        {c.offer ? <span className="t-footnote rounded-full bg-success-tint px-2 py-0.5 text-success">Offer drafted</span> : null}
                      </div>
                    </li>
                  )
                })}
                {inCol.length === 0 ? <li className="t-footnote px-1 py-4 text-center text-ink-3">{col.note ?? "Drop someone here."}</li> : null}
              </ul>
            </section>
          )
        })}
      </div>
      <p className="t-callout mt-4 text-ink-2">Drag a card to Review, Interview, Offer or Hired, or use the menu on the card. New, Invited and In assessment move on their own. {cards.filter((c) => !columnOf(stageOf(c))).length > 0 ? `${cards.filter((c) => !columnOf(stageOf(c))).length} closed (rejected or withdrawn) are not shown.` : ""}</p>
    </div>
  )
}
