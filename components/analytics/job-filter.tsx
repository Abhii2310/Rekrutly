"use client"

import { useRouter } from "next/navigation"
import { ChevronDown } from "lucide-react"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"

/** Narrows Analytics to one job. The choice lives in the URL (`?job=`), so a reload or a shared link keeps it. */
export function JobFilter({ jobs, selected }: { jobs: { id: string; title: string }[]; selected: string | null }) {
  const router = useRouter()
  const label = jobs.find((j) => j.id === selected)?.title ?? "All jobs"
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="secondary" size="sm" aria-label={`Job: ${label}`}>
          {label}
          <ChevronDown aria-hidden className="ml-1 size-3.5" strokeWidth={1.75} />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuRadioGroup value={selected ?? "all"} onValueChange={(v) => router.push(v === "all" ? "/analytics" : `/analytics?job=${v}`)}>
          <DropdownMenuRadioItem value="all">All jobs</DropdownMenuRadioItem>
          {jobs.map((j) => <DropdownMenuRadioItem key={j.id} value={j.id}>{j.title}</DropdownMenuRadioItem>)}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
