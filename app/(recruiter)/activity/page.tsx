import Link from "next/link"
import { QueryError } from "@/components/frame/query-error"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/ui/empty-state"
import { GroupedList, ListRow } from "@/components/ui/grouped-list"
import { PageBody, PageHeader } from "@/components/ui/page-header"
import { SimulatedTag } from "@/components/ui/tags"
import { ACTIVITY_GROUPS, parseGroup } from "@/lib/activity"
import { listActivity } from "@/lib/db/queries/activity"
import { formatDateTime } from "@/lib/format"
import { cn } from "cn"

export const dynamic = "force-dynamic"

const ACTOR = { recruiter: "You", agent: "Rekrutly", system: "System", candidate: "Candidate" } as const

export default async function ActivityPage({ searchParams }: { searchParams: Promise<{ group?: string; before?: string }> }) {
  const sp = await searchParams
  const group = parseGroup(sp.group)
  const before = sp.before && /^\d+$/.test(sp.before) ? Number(sp.before) : null
  const res = await listActivity(group, before)
  if (!res.ok) {
    return (
      <>
        <PageHeader title="Activity" />
        <PageBody><QueryError message="Couldn't load the activity." /></PageBody>
      </>
    )
  }
  const { rows, hasMore } = res.data
  const last = rows[rows.length - 1]
  const href = (g: string) => (g === "all" ? "/activity" : `/activity?group=${g}`)

  return (
    <>
      <PageHeader
        title="Activity"
        description="A receipt for everything Rekrutly and your team did. Receipts are never edited."
        actions={<Button asChild variant="secondary" size="sm"><a href={`/api/activity/export?group=${group}`} download>Export CSV</a></Button>}
      />
      <PageBody>
        <nav aria-label="Filter activity" className="mb-6 flex flex-wrap gap-1.5">
          {ACTIVITY_GROUPS.map((g) => (
            <Link
              key={g.key} href={href(g.key)} aria-current={g.key === group ? "page" : undefined}
              className={cn("focus-ring t-callout rounded-full px-3.5 py-1.5 transition-colors duration-[160ms]", g.key === group ? "bg-ink text-white" : "bg-mist text-ink-2 hover:text-ink")}
            >
              {g.label}
            </Link>
          ))}
        </nav>
        {rows.length === 0 ? (
          <div className="rounded-group bg-mist"><EmptyState message="Nothing here yet. Receipts appear as Rekrutly and your team work." /></div>
        ) : (
          <GroupedList>
            {rows.map((e) => (
              <ListRow
                key={e.id} wrap
                title={<span className="t-body font-normal">{e.message}</span>}
                subtitle={`${ACTOR[e.actor]}${e.candidate ? `, ${e.candidate}` : ""}`}
                value={formatDateTime(e.created_at)}
                pill={e.is_simulated ? <SimulatedTag /> : undefined}
              />
            ))}
          </GroupedList>
        )}
        {hasMore && last ? (
          <div className="mt-6">
            <Button asChild variant="secondary"><Link href={`/activity?${group === "all" ? "" : `group=${group}&`}before=${last.id}`}>Older</Link></Button>
          </div>
        ) : null}
      </PageBody>
    </>
  )
}
