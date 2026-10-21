"use client"

import * as React from "react"
import { Check, ChevronDown } from "lucide-react"
import { cn } from "cn"
import { AIMark } from "@/components/ui/ai-mark"
import { Button } from "@/components/ui/button"
import { Popover, PopoverClose, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Pill } from "@/components/ui/status-pill"
import type { ReviewQuestion } from "@/lib/db/queries/assessments"
import { QuestionForm, toBody, valuesFrom, type FormValues } from "./question-form"
import { RichText, firstLine } from "./rich-text"

const TYPE_LABEL = { mcq: "Multiple choice", short: "Written answer" } as const
const DIFFICULTY_LABEL = { easy: "Easy", medium: "Medium", hard: "Hard" } as const

export type RowHandlers = {
  save: (id: string, body: unknown) => Promise<string | null>
  regenerate: (id: string) => Promise<string | null>
  remove: (id: string) => Promise<string | null>
}

export function QuestionRow({
  question, index, editable, canDelete, handlers, saved = false,
}: {
  question: ReviewQuestion
  index: number
  editable: boolean
  canDelete: boolean
  /** From the saved demo set, not the AI. */
  saved?: boolean
  handlers: RowHandlers
}) {
  const [open, setOpen] = React.useState(false)
  const [editing, setEditing] = React.useState(false)
  const [busy, setBusy] = React.useState<"regenerate" | "delete" | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const [confirm, setConfirm] = React.useState(false)
  const panelId = React.useId()
  const edited = question.edited_by_recruiter

  async function run(kind: "regenerate" | "delete") {
    setBusy(kind)
    setError(null)
    const message = await (kind === "regenerate" ? handlers.regenerate(question.id) : handlers.remove(question.id))
    setBusy(null)
    if (message) setError(message)
  }

  async function save(values: FormValues): Promise<string | null> {
    const { type: _type, ...body } = toBody(values) as { type: string } & Record<string, unknown>
    void _type
    const message = await handlers.save(question.id, body)
    if (!message) setEditing(false)
    return message
  }

  return (
    <li className="relative list-none after:absolute after:bottom-0 after:left-4 after:right-0 after:h-px after:bg-hairline/70 last:after:hidden">
      <div className={cn("flex min-h-14 items-center gap-3 px-4 py-2", busy === "regenerate" && "opacity-50")}>
        <button
          type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-controls={panelId}
          className="focus-ring flex min-w-0 flex-1 items-center gap-3 rounded-md text-left"
        >
          <span className="t-callout tabular w-5 shrink-0 text-ink-2">{index + 1}</span>
          <span className="min-w-0 flex-1">
            <span className="t-body block truncate font-medium text-ink">{firstLine(question.prompt)}</span>
            <span className="t-callout block truncate text-ink-2">{TYPE_LABEL[question.type]}, {question.skill}</span>
          </span>
        </button>
        <Pill>{DIFFICULTY_LABEL[question.difficulty]}</Pill>
        {edited ? <span className="t-footnote text-ink-2">Edited</span> : question.ai_generated ? (saved ? <Pill>Saved</Pill> : <AIMark />) : null}
        <button
          type="button" onClick={() => setOpen((o) => !o)} aria-label={open ? "Hide details" : "Show details"} aria-expanded={open}
          className="focus-ring inline-flex size-8 shrink-0 items-center justify-center rounded-full text-ink-3 hover:text-ink"
        >
          <ChevronDown aria-hidden className={cn("size-4 transition-transform duration-[160ms]", open && "rotate-180")} strokeWidth={1.75} />
        </button>
      </div>

      {open ? (
        <div id={panelId} className="px-4 pb-5 pl-12">
          {editing ? (
            <QuestionForm initial={valuesFrom(question)} mode="edit" onSave={save} onCancel={() => setEditing(false)} />
          ) : (
            <>
              <RichText text={question.prompt} />
              {question.type === "mcq" && question.options ? (
                <ol className="mt-4 flex flex-col gap-2">
                  {question.options.map((o, i) => {
                    const correct = question.key?.correct_option === i
                    return (
                      <li key={i} className="t-body flex items-start gap-3 text-ink">
                        <span className="t-callout mt-0.5 w-4 shrink-0 text-ink-2">{"ABCD"[i]}</span>
                        <span className="flex-1">{o}</span>
                        {correct ? (
                          <span className="t-footnote inline-flex shrink-0 items-center gap-1 text-success">
                            <Check aria-hidden className="size-3.5" strokeWidth={2.5} /> Correct answer
                          </span>
                        ) : null}
                      </li>
                    )
                  })}
                </ol>
              ) : null}
              {question.type === "mcq" && question.key?.explanation ? (
                <p className="t-callout mt-3 text-ink-2">{question.key.explanation}</p>
              ) : null}
              {question.type === "short" && question.key?.rubric ? (
                <div className="mt-4">
                  <p className="t-callout font-medium text-ink">A good answer covers</p>
                  <ul className="mt-1.5 flex flex-col gap-1">
                    {question.key.rubric.criteria.map((c, i) => (
                      <li key={i} className="t-body flex gap-3 text-ink">
                        <span className="t-callout tabular w-10 shrink-0 text-ink-2">{c.weight} pt{c.weight === 1 ? "" : "s"}</span>
                        <span>{c.point}</span>
                      </li>
                    ))}
                  </ul>
                  <p className="t-callout mt-3 font-medium text-ink">Model answer</p>
                  <p className="t-body mt-1 whitespace-pre-wrap text-ink-2">{question.key.rubric.model_answer}</p>
                </div>
              ) : null}
              <p className="t-callout tabular mt-4 text-ink-2">{question.max_score} {question.max_score === 1 ? "point" : "points"}</p>

              {editable ? (
                <div className="mt-4 flex flex-wrap items-center gap-4">
                  <Button variant="plain" size="sm" onClick={() => setEditing(true)} disabled={busy !== null}>Edit</Button>
                  <Button variant="plain" size="sm" loading={busy === "regenerate"} disabled={busy !== null} onClick={() => run("regenerate")}>Regenerate</Button>
                  <Popover open={confirm} onOpenChange={setConfirm}>
                    <PopoverTrigger asChild>
                      <Button variant="destructive" size="sm" disabled={busy !== null || !canDelete}>Delete</Button>
                    </PopoverTrigger>
                    <PopoverContent align="start">
                      <p className="t-body text-ink">Delete this question?</p>
                      <div className="mt-3 flex items-center gap-3">
                        <Button variant="destructive" size="sm" onClick={() => { setConfirm(false); void run("delete") }}>Delete</Button>
                        <PopoverClose asChild><Button variant="plain" size="sm">Cancel</Button></PopoverClose>
                      </div>
                    </PopoverContent>
                  </Popover>
                  {!canDelete ? <span className="t-callout text-ink-2">An assessment needs at least 3 questions.</span> : null}
                </div>
              ) : null}
              {error ? <p role="alert" className="t-callout mt-3 text-danger">{error}</p> : null}
            </>
          )}
        </div>
      ) : null}
    </li>
  )
}
