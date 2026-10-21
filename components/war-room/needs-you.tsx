"use client"

import * as React from "react"
import Link from "next/link"
import { ChevronDown } from "lucide-react"
import { cn } from "cn"
import { AIMark } from "@/components/ui/ai-mark"
import { Button } from "@/components/ui/button"
import { SegmentedControl } from "@/components/ui/segmented-control"
import { toast } from "@/components/ui/toaster"
import { copyText } from "@/lib/copy-text"
import type { LiveTask } from "@/lib/db/queries/live"
import type { TaskDraft } from "@/lib/db/types"
import { TASK_TYPE_LABELS, type TaskType } from "@/lib/status"
import { whatsappUrl } from "@/lib/tasks/whatsapp"

type Language = TaskDraft["language"]
const LANGUAGES = [{ value: "en", label: "English" }, { value: "hi", label: "हिन्दी" }, { value: "kn", label: "ಕನ್ನಡ" }] as const

async function call(url: string, init: RequestInit): Promise<{ ok: true; data: unknown } | { ok: false; message: string }> {
  try {
    const res = await fetch(url, { ...init, headers: { "content-type": "application/json" } })
    const json = (await res.json().catch(() => null)) as { data?: unknown; error?: { message?: string } } | null
    if (res.ok) return { ok: true, data: json?.data }
    return { ok: false, message: json?.error?.message ?? "Something went wrong. Try again." }
  } catch {
    return { ok: false, message: "Couldn't reach the server. Check your connection and retry." }
  }
}

function TaskCard({ task, onClosed }: { task: LiveTask; onClosed: (id: string) => void }) {
  const [open, setOpen] = React.useState(false)
  const [mine, setMine] = React.useState<TaskDraft | null>(null)
  const [lang, setLang] = React.useState<Language | null>(null)
  const [writing, setWriting] = React.useState(false)
  const [closing, setClosing] = React.useState<"done" | "dismissed" | null>(null)
  const draft = mine ?? task.draft
  const language = lang ?? draft?.language ?? "en"
  const isFollowUp = task.type === "follow_up"
  const wa = draft ? whatsappUrl(task.candidate?.phone, draft.whatsapp_text) : null

  async function write(next: Language) {
    setLang(next)
    setWriting(true)
    const res = await call(`/api/tasks/${task.id}/draft`, { method: "POST", body: JSON.stringify({ language: next }) })
    setWriting(false)
    if (res.ok) setMine((res.data as { draft: TaskDraft }).draft)
    else { toast(res.message); setLang(null) }
  }

  async function close(status: "done" | "dismissed") {
    setClosing(status)
    const res = await call(`/api/tasks/${task.id}`, { method: "PATCH", body: JSON.stringify({ status }) })
    if (res.ok) { toast(status === "done" ? "Marked done" : "Dismissed"); onClosed(task.id) }
    else { toast(res.message); setClosing(null) }
  }

  async function copy(text: string, done: string) {
    toast((await copyText(text)) ? done : "Couldn't copy. Select the text and copy it by hand.")
  }

  return (
    <li className="relative list-none after:absolute after:bottom-0 after:left-4 after:right-0 after:h-px after:bg-hairline/70 last:after:hidden">
      <button
        type="button" aria-expanded={open} onClick={() => setOpen((o) => !o)}
        className="focus-ring flex min-h-14 w-full items-center gap-3 px-4 py-2 text-left transition-colors duration-[160ms] hover:bg-mist/60"
      >
        <span className="min-w-0 flex-1">
          <span className="t-headline block truncate text-ink">{task.title}</span>
          <span className="t-callout block truncate text-ink-2">{draft ? "Message drafted" : (task.detail ?? TASK_TYPE_LABELS[task.type as TaskType] ?? "Task")}</span>
        </span>
        <ChevronDown aria-hidden strokeWidth={1.75} className={cn("size-4 shrink-0 text-ink-3 transition-transform duration-[160ms]", open && "rotate-180")} />
      </button>

      {open ? (
        <div className="px-4 pb-4">
          {task.detail ? <p className="t-callout mb-3 text-ink-2">{task.detail}</p> : null}
          {isFollowUp ? (
            <>
              <SegmentedControl ariaLabel="Message language" options={LANGUAGES} value={language} onChange={(l) => { if (!writing) void write(l) }} />
              <div className="mt-3 min-h-28 rounded-[10px] bg-mist p-4">
                {writing ? (
                  <p className="t-callout text-ink-2" aria-live="polite">Writing the message…</p>
                ) : draft ? (
                  <div className="flex flex-col gap-3">
                    <div className="flex items-start justify-between gap-3">
                      <p className="t-callout font-medium text-ink">{draft.subject}</p>
                      <AIMark label="Drafted by AI" />
                    </div>
                    <p className="t-body whitespace-pre-wrap break-words text-ink" lang={draft.language}>{draft.body}</p>
                    <div>
                      <p className="t-footnote mb-1 text-ink-2">Shorter, for WhatsApp</p>
                      <p className="t-callout whitespace-pre-wrap break-words text-ink" lang={draft.language}>{draft.whatsapp_text}</p>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-start gap-3">
                    <p className="t-callout text-ink-2">No message yet. Rekrutly writes it, you read it, and you send it yourself.</p>
                    <Button variant="secondary" size="sm" onClick={() => void write(language)}>Write message</Button>
                  </div>
                )}
              </div>
              <p className="t-footnote mt-2 text-ink-2">Nothing is sent automatically. Read the message before you send it.</p>
            </>
          ) : null}

          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
            {isFollowUp && draft && !writing ? (
              <>
                <Button variant="secondary" size="sm" onClick={() => void copy(draft.whatsapp_text, "Message copied")}>Copy message</Button>
                {wa ? <Button asChild variant="secondary" size="sm"><a href={wa} target="_blank" rel="noopener noreferrer">Open in WhatsApp</a></Button> : null}
                {task.candidate?.email ? <Button variant="secondary" size="sm" onClick={() => void copy(`Subject: ${draft.subject}\n\n${draft.body}`, "Email copied")}>Copy email</Button> : null}
              </>
            ) : null}
            {task.href ? <Button asChild variant="secondary" size="sm"><Link href={task.href}>Open</Link></Button> : null}
            <Button variant="plain" size="sm" loading={closing === "done"} disabled={closing !== null} onClick={() => void close("done")}>Mark done</Button>
            <Button variant="plain" size="sm" loading={closing === "dismissed"} disabled={closing !== null} className="text-ink-2 hover:text-ink" onClick={() => void close("dismissed")}>Dismiss</Button>
          </div>
        </div>
      ) : null}
    </li>
  )
}

/** Open tasks. A task that was just closed disappears at once; the next poll confirms it. */
export function NeedsYou({ tasks }: { tasks: LiveTask[] }) {
  const [closed, setClosed] = React.useState<ReadonlySet<string>>(new Set())
  const visible = tasks.filter((t) => !closed.has(t.id))
  if (visible.length === 0) return <p className="t-body py-2 text-ink-2">Nothing needs you right now.</p>
  return (
    <div className="rounded-group bg-mist p-1">
      <ul className="overflow-hidden rounded-[10px] bg-canvas">
        {visible.map((t) => <TaskCard key={t.id} task={t} onClosed={(id) => setClosed((s) => new Set(s).add(id))} />)}
      </ul>
    </div>
  )
}
