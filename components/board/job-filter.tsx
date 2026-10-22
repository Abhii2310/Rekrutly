"use client"

import { useRouter } from "next/navigation"
import { ChevronDown } from "lucide-react"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"

export function BoardJobFilter({ jobs, jobId }: { jobs: { id: string; title: string }[]; jobId: string }) {
  const router = useRouter()
  const title = jobs.find((j) => j.id === jobId)?.title ?? "All roles"
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="secondary" size="sm">{title}<ChevronDown aria-hidden className="ml-1 size-3.5" strokeWidth={1.75} /></Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuRadioGroup value={jobId} onValueChange={(v) => router.push(v ? `/board?job=${v}` : "/board")}>
          <DropdownMenuRadioItem value="">All roles</DropdownMenuRadioItem>
          {jobs.map((j) => <DropdownMenuRadioItem key={j.id} value={j.id}>{j.title}</DropdownMenuRadioItem>)}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
