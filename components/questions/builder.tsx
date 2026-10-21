"use client"

import * as React from "react"
import { usePathname, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { ErrorState } from "@/components/ui/error-state"
import { Input } from "@/components/ui/input"
import { ProgressRail, type RailStep } from "@/components/ui/progress-rail"
import { Section } from "@/components/ui/section"
import { Pill } from "@/components/ui/status-pill"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "@/components/ui/toaster"
import { plural } from "@/lib/format-text"
import type { AssessmentForReview } from "@/lib/db/queries/assessments"
import { QuestionForm, blankValues, toBody } from "./question-form"
import { QuestionRow, type RowHandlers } from "./question-row"

type StepView = { id: string; title: string; status: RailStep["status"]; detail?: string; action: string }

type Props = {
  runId: string
  steps: StepView[]
  review: AssessmentForReview | null
  editable: boolean
  autoStart: boolean
  plannedCount: number
  warnings: string[]
  /** DEMO_MODE only: lets a failed generation fall back to the saved question set. */
  demoMode?: boolean
  /** The questions came from the saved set, not the AI. */
  saved?: boolean
}

async function call(url: string, method: string, body?: unknown): Promise<string | null> {
  try {
    const res = await fetch(url, { method, headers: { "content-type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) })
    if (res.ok) return null
    const json = (await res.json().catch(() => null)) as { error?: { message?: string } } | null
    return json?.error?.message ?? "Something went wrong. Try again."
  } catch {
    return "Couldn't reach the server. Check your connection and retry."
  }
}

export function QuestionBuilder({ runId, steps, review, editable, autoStart, plannedCount, warnings, demoMode = false, saved = false }: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const started = React.useRef(false)
  const [generating, setGenerating] = React.useState(false)
  const [genError, setGenError] = React.useState<string | null>(null)
  const [adding, setAdding] = React.useState(false)
  const [renaming, setRenaming] = React.useState(false)
  const [title, setTitle] = React.useState(review?.assessment.title ?? "")

  const serverGenerating = !review && steps.some((s) => s.action === "generate_questions" && s.status === "executing")
  const busy = generating || serverGenerating

  const generate = React.useCallback(async (useSaved = false) => {
    setGenerating(true)
    setGenError(null)
    const message = await call(`/api/runs/${runId}/questions`, "POST", useSaved ? { useSaved: true } : {})
    setGenerating(false)
    if (message) setGenError(message)
    else toast(useSaved ? "Saved questions loaded" : "Questions are ready")
    router.replace(pathname) // drops ?generate=1
    router.refresh()
  }, [runId, router, pathname])

  // Opening the page from the Command Centre starts the questions once.
  React.useEffect(() => {
    if (autoStart && !review && !started.current) {
      started.current = true
      void generate()
    }
  }, [autoStart, review, generate])

  // A reload mid-generation: keep checking until the server has finished.
  React.useEffect(() => {
    if (!serverGenerating || generating) return
    const t = setInterval(() => router.refresh(), 3000)
    return () => clearInterval(t)
  }, [serverGenerating, generating, router])

  const handlers: RowHandlers = {
    save: async (id, body) => {
      const message = await call(`/api/questions/${id}`, "PATCH", body)
      if (!message) { toast("Saved"); router.refresh() }
      return message
    },
    regenerate: async (id) => {
      const message = await call(`/api/questions/${id}/regenerate`, "POST")
      if (!message) { toast("Question regenerated"); router.refresh() }
      return message
    },
    remove: async (id) => {
      const message = await call(`/api/questions/${id}`, "DELETE")
      if (!message) { toast("Question deleted"); router.refresh() }
      return message
    },
  }

  const rail: RailStep[] = steps.map((s) => ({
    id: s.id, title: s.title, detail: s.detail,
    status: s.action === "generate_questions" && generating ? "executing" : s.status,
  }))

  async function saveTitle() {
    if (!review || title.trim() === review.assessment.title) return setRenaming(false)
    const message = await call(`/api/assessments/${review.assessment.id}`, "PATCH", { title: title.trim() })
    if (message) return toast(message)
    setRenaming(false)
    router.refresh()
  }

  const questions = review?.questions ?? []
  const skillCount = new Set(questions.map((q) => q.skill)).size

  return (
    <>
      {!review || busy || genError ? (
        <Section title="Steps" className="mt-10">
          <ProgressRail steps={rail} />
        </Section>
      ) : null}

      <Section title="Questions" className={review && !busy && !genError ? "mt-0" : undefined}>
        {busy ? (
          <div role="status">
            <p className="t-callout mb-4 text-ink-2">Writing {plural(plannedCount, "question")}. This takes about 30 seconds.</p>
            <div className="flex flex-col gap-2">{Array.from({ length: plannedCount }, (_, i) => <Skeleton key={i} className="h-14 w-full" />)}</div>
          </div>
        ) : genError && !review ? (
          <ErrorState
            message={genError} hint="Retry, or change the plan from the Command Centre." onRetry={() => void generate()}
            secondary={demoMode ? { label: "Use saved questions", onClick: () => void generate(true) } : undefined}
          />
        ) : !review ? (
          <div className="rounded-group bg-mist px-6 py-14 text-center">
            <p className="t-body text-ink-2">The questions haven&apos;t been written yet.</p>
            <div className="mt-5"><Button onClick={() => void generate()}>Write the questions</Button></div>
          </div>
        ) : (
          <div>
            <div className="mb-5 flex items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                {renaming ? (
                  <form onSubmit={(e) => { e.preventDefault(); void saveTitle() }} className="flex items-center gap-3">
                    <Input aria-label="Assessment title" value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />
                    <Button type="submit" size="sm">Save</Button>
                    <Button variant="plain" size="sm" onClick={() => { setTitle(review.assessment.title); setRenaming(false) }}>Cancel</Button>
                  </form>
                ) : (
                  <div className="flex items-center gap-3">
                    <h3 className="t-headline truncate text-ink">{review.assessment.title}</h3>
                    {saved ? <Pill>Saved</Pill> : null}
                    {editable ? <Button variant="plain" size="sm" onClick={() => setRenaming(true)}>Rename</Button> : null}
                  </div>
                )}
                <p className="t-callout tabular mt-1 text-ink-2">
                  {plural(questions.length, "question")}, {review.assessment.duration_minutes} minutes, {plural(skillCount, "skill")}
                </p>
              </div>
            </div>

            {warnings.length > 0 ? (
              <div role="note" className="mb-4 rounded-group bg-warning-tint p-4">
                {warnings.map((w) => <p key={w} className="t-callout text-ink">{w}</p>)}
              </div>
            ) : null}

            <div className="rounded-group bg-mist p-1">
              <ul className="overflow-hidden rounded-[10px] bg-canvas">
                {questions.map((q, i) => (
                  <QuestionRow key={q.id} question={q} index={i} editable={editable} canDelete={questions.length > 3} handlers={handlers} saved={saved} />
                ))}
              </ul>
            </div>

            {editable ? (
              <div className="mt-4">
                {adding ? (
                  <div className="rounded-group bg-mist p-5">
                    <QuestionForm
                      mode="add" initial={blankValues(review.assessment.skills[0] ?? "")} onCancel={() => setAdding(false)}
                      onSave={async (values) => {
                        const message = await call(`/api/assessments/${review.assessment.id}/questions`, "POST", toBody(values))
                        if (!message) { toast("Question added"); setAdding(false); router.refresh() }
                        return message
                      }}
                    />
                  </div>
                ) : (
                  <Button variant="plain" onClick={() => setAdding(true)}>Add question</Button>
                )}
              </div>
            ) : null}
          </div>
        )}
      </Section>
    </>
  )
}
