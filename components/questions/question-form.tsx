"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { SegmentedControl } from "@/components/ui/segmented-control"
import { Textarea } from "@/components/ui/textarea"
import { pointsFor } from "@/lib/ai/question-rules"
import type { ReviewQuestion } from "@/lib/db/queries/assessments"

type Difficulty = "easy" | "medium" | "hard"
type Criterion = { point: string; weight: number }

export type FormValues = {
  type: "mcq" | "short"
  prompt: string
  skill: string
  difficulty: Difficulty
  max_score: number
  options: string[]
  correct_option: number
  explanation: string
  criteria: Criterion[]
  model_answer: string
}

export function blankValues(skill: string): FormValues {
  return {
    type: "mcq", prompt: "", skill, difficulty: "medium", max_score: pointsFor("mcq", "medium"),
    options: ["", "", "", ""], correct_option: 0, explanation: "",
    criteria: [{ point: "", weight: 2 }, { point: "", weight: 2 }], model_answer: "",
  }
}

export function valuesFrom(q: ReviewQuestion): FormValues {
  return {
    type: q.type, prompt: q.prompt, skill: q.skill, difficulty: q.difficulty, max_score: q.max_score,
    options: q.options ?? ["", "", "", ""], correct_option: q.key?.correct_option ?? 0, explanation: q.key?.explanation ?? "",
    criteria: q.key?.rubric?.criteria ?? [{ point: "", weight: 2 }, { point: "", weight: 2 }], model_answer: q.key?.rubric?.model_answer ?? "",
  }
}

/** The JSON body for PATCH (edit) or POST (add). */
export function toBody(v: FormValues) {
  const common = { type: v.type, prompt: v.prompt, skill: v.skill, difficulty: v.difficulty, max_score: v.max_score }
  return v.type === "mcq"
    ? { ...common, options: v.options, correct_option: v.correct_option, explanation: v.explanation }
    : { ...common, rubric: { criteria: v.criteria, model_answer: v.model_answer } }
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="t-callout font-medium text-ink">{label}</label>
      {children}
    </div>
  )
}

export function QuestionForm({
  initial, mode, onSave, onCancel,
}: {
  initial: FormValues
  mode: "edit" | "add"
  onSave: (values: FormValues) => Promise<string | null>
  onCancel: () => void
}) {
  const [v, setV] = React.useState<FormValues>(initial)
  const [error, setError] = React.useState<string | null>(null)
  const [saving, setSaving] = React.useState(false)
  const id = React.useId()
  const set = <K extends keyof FormValues>(k: K, val: FormValues[K]) => setV((p) => ({ ...p, [k]: val }))

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    const message = await onSave(v)
    setSaving(false)
    if (message) setError(message)
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-5">
      {mode === "add" ? (
        <SegmentedControl
          ariaLabel="Question type"
          value={v.type}
          onChange={(t) => setV((p) => ({ ...p, type: t, max_score: pointsFor(t, p.difficulty) }))}
          options={[{ value: "mcq", label: "Multiple choice" }, { value: "short", label: "Written answer" }]}
        />
      ) : null}

      <Field label="Question">
        <Textarea aria-label="Question" value={v.prompt} onChange={(e) => set("prompt", e.target.value)} />
      </Field>

      {v.type === "mcq" ? (
        <fieldset className="flex flex-col gap-2">
          <legend className="t-callout mb-1.5 font-medium text-ink">Options. Choose the correct one.</legend>
          {v.options.map((o, i) => (
            <div key={i} className="flex items-center gap-3">
              <input
                type="radio" name={`${id}-correct`} checked={v.correct_option === i} onChange={() => set("correct_option", i)}
                aria-label={`Option ${"ABCD"[i]} is correct`} className="focus-ring size-5 shrink-0 accent-[var(--color-action)]"
              />
              <Input aria-label={`Option ${"ABCD"[i]}`} value={o} onChange={(e) => set("options", v.options.map((x, j) => (j === i ? e.target.value : x)))} />
            </div>
          ))}
          <Field label="Why it is correct (optional)">
            <Textarea aria-label="Explanation" value={v.explanation} onChange={(e) => set("explanation", e.target.value)} />
          </Field>
        </fieldset>
      ) : (
        <fieldset className="flex flex-col gap-2">
          <legend className="t-callout mb-1.5 font-medium text-ink">Rubric points. A good answer covers these.</legend>
          {v.criteria.map((c, i) => (
            <div key={i} className="flex items-center gap-3">
              <Input aria-label={`Rubric point ${i + 1}`} value={c.point} onChange={(e) => set("criteria", v.criteria.map((x, j) => (j === i ? { ...x, point: e.target.value } : x)))} />
              <Input
                aria-label={`Weight for point ${i + 1}`} type="number" min={1} max={5} value={c.weight} className="w-20 shrink-0"
                onChange={(e) => set("criteria", v.criteria.map((x, j) => (j === i ? { ...x, weight: Number(e.target.value) } : x)))}
              />
              {v.criteria.length > 2 ? (
                <Button variant="plain" size="sm" onClick={() => set("criteria", v.criteria.filter((_, j) => j !== i))}>Remove</Button>
              ) : null}
            </div>
          ))}
          {v.criteria.length < 5 ? (
            <div><Button variant="plain" size="sm" onClick={() => set("criteria", [...v.criteria, { point: "", weight: 2 }])}>Add point</Button></div>
          ) : null}
          <Field label="Model answer">
            <Textarea aria-label="Model answer" value={v.model_answer} onChange={(e) => set("model_answer", e.target.value)} />
          </Field>
        </fieldset>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Skill"><Input aria-label="Skill" value={v.skill} onChange={(e) => set("skill", e.target.value)} /></Field>
        <Field label="Difficulty">
          <SegmentedControl
            ariaLabel="Difficulty" value={v.difficulty}
            onChange={(d) => setV((p) => ({ ...p, difficulty: d, max_score: pointsFor(p.type, d) }))}
            options={[{ value: "easy", label: "Easy" }, { value: "medium", label: "Medium" }, { value: "hard", label: "Hard" }]}
          />
        </Field>
        <Field label="Points">
          <Input aria-label="Points" type="number" min={1} max={20} value={v.max_score} onChange={(e) => set("max_score", Number(e.target.value))} />
        </Field>
      </div>

      {error ? <p role="alert" className="t-callout text-danger">{error}</p> : null}
      <div className="flex items-center gap-3">
        <Button type="submit" loading={saving}>{mode === "add" ? "Add question" : "Save"}</Button>
        <Button variant="plain" onClick={onCancel}>Cancel</Button>
      </div>
    </form>
  )
}
