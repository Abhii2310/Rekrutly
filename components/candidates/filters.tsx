"use client"

import * as React from "react"
import { usePathname, useRouter } from "next/navigation"
import { ChevronDown } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { SegmentedControl } from "@/components/ui/segmented-control"
import { DropdownMenu, DropdownMenuContent, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { STAGE_GROUPS, type StageGroup } from "@/lib/candidate-groups"

type Props = { group: StageGroup; jobId: string; search: string; jobs: { id: string; title: string }[] }

/** Filters live in the URL, so they survive a refresh and can be shared. */
export function CandidateFilters({ group, jobId, search, jobs }: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const [text, setText] = React.useState(search)

  const go = React.useCallback(
    (next: { g?: string; job?: string; q?: string }) => {
      const p = new URLSearchParams()
      const g = next.g ?? group
      const job = next.job ?? jobId
      const q = next.q ?? text
      if (g !== "all") p.set("g", g)
      if (job) p.set("job", job)
      if (q.trim()) p.set("q", q.trim())
      const qs = p.toString()
      router.replace(qs ? `${pathname}?${qs}` : pathname)
    },
    [group, jobId, text, pathname, router]
  )

  // Debounced search: only fire when the box differs from the URL.
  React.useEffect(() => {
    if (text.trim() === search.trim()) return
    const t = setTimeout(() => go({ q: text }), 300)
    return () => clearTimeout(t)
  }, [text, search, go])

  const jobTitle = jobs.find((j) => j.id === jobId)?.title ?? "All jobs"

  return (
    <div className="mb-6 flex flex-wrap items-center gap-3">
      <SegmentedControl
        ariaLabel="Stage"
        value={group}
        onChange={(g) => go({ g })}
        options={STAGE_GROUPS.map((g) => ({ value: g.value, label: g.label }))}
      />
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="secondary" aria-label={`Job: ${jobTitle}`}>
            {jobTitle}
            <ChevronDown aria-hidden className="ml-1.5 size-4" strokeWidth={1.75} />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuRadioGroup value={jobId || "all"} onValueChange={(v) => go({ job: v === "all" ? "" : v })}>
            <DropdownMenuRadioItem value="all">All jobs</DropdownMenuRadioItem>
            {jobs.map((j) => (
              <DropdownMenuRadioItem key={j.id} value={j.id}>{j.title}</DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>
      <Input
        type="search"
        aria-label="Search candidates"
        placeholder="Search by name, role or company"
        value={text}
        onChange={(e) => setText(e.target.value)}
        className="w-full sm:w-[280px]"
      />
    </div>
  )
}
