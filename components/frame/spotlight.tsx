"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Sparkles } from "lucide-react"
import { Command as CommandPrimitive } from "cmdk"
import { CommandDialog, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { Kbd } from "@/components/ui/kbd"
import { MicButton } from "@/components/ui/mic-button"
import { useSpeechInput } from "@/hooks/use-speech"

type Data = { jobs: { id: string; title: string }[]; candidates: { id: string; name: string; job: string }[]; warRoomRunId: string | null }

const UUID = /\/jobs\/([0-9a-f-]{36})/i

/** The job Spotlight should plan for: the job page you are on, or the job chosen in the Command Centre. */
function currentJobId(): string | null {
  const fromPath = UUID.exec(window.location.pathname)?.[1]
  if (fromPath) return fromPath
  return new URLSearchParams(window.location.search).get("job")
}

/**
 * Cmd/Ctrl+K from anywhere in the recruiter app. A sentence plus Enter goes to the planner (through the Command
 * Centre); arrow keys reach quick navigation. Nothing runs from here without the approval screen.
 */
export function Spotlight() {
  const router = useRouter()
  const [open, setOpen] = React.useState(false)
  const [query, setQuery] = React.useState("")
  const [data, setData] = React.useState<Data | null>(null)
  const speech = useSpeechInput(setQuery)

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault()
        setOpen((o) => !o)
      }
    }
    const onOpen = () => setOpen(true)
    window.addEventListener("keydown", onKey)
    window.addEventListener("spotlight:open", onOpen)
    return () => { window.removeEventListener("keydown", onKey); window.removeEventListener("spotlight:open", onOpen) }
  }, [])

  // Fresh names every time it opens.
  React.useEffect(() => {
    if (!open) return
    let stopped = false
    fetch("/api/spotlight", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((b: { data?: Data } | null) => { if (!stopped && b?.data) setData(b.data) })
      .catch(() => {})
    return () => { stopped = true }
  }, [open])

  function go(href: string) {
    setOpen(false)
    setQuery("")
    router.push(href)
  }

  function ask() {
    const text = query.trim()
    if (text.length < 3) return
    const job = currentJobId()
    go(`/command?q=${encodeURIComponent(text)}${job ? `&job=${job}` : ""}`)
  }

  const words = query.trim().split(/\s+/).filter(Boolean).length
  const sentence = words >= 3
  const canAsk = query.trim().length >= 3
  const askItem = canAsk ? (
    <CommandItem key="ask" value={`ask rekrutly ${query}`} forceMount onSelect={ask}>
      <Sparkles aria-hidden className="size-4 shrink-0 text-ai" strokeWidth={1.75} />
      <span className="min-w-0 flex-1 truncate">Ask Rekrutly: &ldquo;{query.trim()}&rdquo;</span>
      <Kbd>Enter</Kbd>
    </CommandItem>
  ) : null

  return (
    <CommandDialog
      open={open}
      onOpenChange={(o) => { setOpen(o); if (!o) setQuery("") }}
      title="Spotlight"
      description="Type an instruction for Rekrutly, or jump to a job, candidate or the War Room."
    >
      <div className="flex items-center border-b border-hairline/60 pr-3">
        <CommandInput value={query} onValueChange={setQuery} placeholder="Ask Rekrutly, or jump to…" className="min-w-0 flex-1 border-b-0" />
        {speech.supported ? <MicButton listening={speech.listening} onClick={() => speech.toggle(query)} /> : null}
      </div>
      {speech.listening ? <p role="status" className="t-callout px-5 pt-3 text-ink-2">Listening. Speak now, and pause for a few seconds when you are done.</p> : null}
      {speech.error ? <p role="status" className="t-callout px-5 pt-3 text-ink-2">{speech.error}</p> : null}
      <CommandList>
        {sentence ? <CommandPrimitive.Group forceMount>{askItem}</CommandPrimitive.Group> : null}
        <CommandGroup heading="Go to">
          <CommandItem value="command centre new task" onSelect={() => go("/command")}>Command Centre</CommandItem>
          {data?.warRoomRunId ? <CommandItem value="war room live workflow" onSelect={() => go(`/runs/${data.warRoomRunId}/war-room`)}>War Room</CommandItem> : null}
          <CommandItem value="overview home" onSelect={() => go("/")}>Overview</CommandItem>
          <CommandItem value="jobs" onSelect={() => go("/jobs")}>Jobs</CommandItem>
          <CommandItem value="candidates" onSelect={() => go("/candidates")}>Candidates</CommandItem>
        </CommandGroup>
        {data && data.jobs.length > 0 ? (
          <CommandGroup heading="Jobs">
            {data.jobs.map((j) => <CommandItem key={j.id} value={`job ${j.title}`} onSelect={() => go(`/jobs/${j.id}`)}>{j.title}</CommandItem>)}
          </CommandGroup>
        ) : null}
        {data && data.candidates.length > 0 ? (
          <CommandGroup heading="Candidates">
            {data.candidates.map((c) => (
              <CommandItem key={c.id} value={`candidate ${c.name} ${c.job}`} onSelect={() => go(`/candidates?c=${c.id}`)}>
                <span className="min-w-0 flex-1 truncate">{c.name}</span>
                <span className="t-callout shrink-0 text-ink-2">{c.job}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        ) : null}
        {!sentence && canAsk ? <CommandPrimitive.Group forceMount>{askItem}</CommandPrimitive.Group> : null}
      </CommandList>
      <div className="t-footnote flex items-center justify-between border-t border-hairline/60 px-5 py-2.5 text-ink-2">
        <span>{sentence ? "Press Enter to ask Rekrutly." : "Type a sentence to ask Rekrutly, or pick a place."}</span>
        <span className="flex items-center gap-1.5"><Kbd>Esc</Kbd> to close</span>
      </div>
    </CommandDialog>
  )
}
