"use client"

import * as React from "react"
import { cn } from "cn"
import { Button } from "@/components/ui/button"
import { Pill } from "@/components/ui/status-pill"
import { Textarea } from "@/components/ui/textarea"
import { RichText } from "@/components/questions/rich-text"
import type { AnswerState, PortalQuestion } from "./api"
import type { SaveStatus } from "./use-autosave"

const SAVE_TEXT: Record<SaveStatus, string> = { idle: "", saving: "Saving…", saved: "Saved", retrying: "Not saved. Retrying…" }

export function Navigator({
  total, current, answered, onJump,
}: { total: number; current: number; answered: boolean[]; onJump: (i: number) => void }) {
  return (
    <nav aria-label="Questions" className="mt-10 flex flex-wrap justify-center">
      {Array.from({ length: total }, (_, i) => (
        <button
          key={i} type="button" onClick={() => onJump(i)} aria-label={`Question ${i + 1}${answered[i] ? ", answered" : ""}`} aria-current={i === current ? "step" : undefined}
          className="focus-ring inline-flex size-8 items-center justify-center rounded-full sm:size-6"
        >
          <span className={cn("block size-2.5 rounded-full border", answered[i] ? "border-ink bg-ink" : "border-hairline bg-canvas", i === current && "ring-2 ring-action ring-offset-2 ring-offset-canvas")} />
        </button>
      ))}
    </nav>
  )
}

export function QuestionScreen({
  question, index, total, answer, onChange, onBlurText, onBack, onNext, nextLabel, saveStatus,
}: {
  question: PortalQuestion
  index: number
  total: number
  answer: AnswerState
  onChange: (a: AnswerState) => void
  onBlurText: () => void
  onBack: () => void
  onNext: () => void
  nextLabel: string
  saveStatus: SaveStatus
}) {
  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <p className="t-callout text-ink-2">Question {index + 1} of {total}</p>
        <Pill>{question.skill}</Pill>
      </div>

      <div className="mt-5 text-[19px] leading-[26px] font-semibold tracking-[-0.015em] text-ink sm:text-[22px] sm:leading-[28px]">
        <RichText text={question.prompt} inheritType />
      </div>

      {question.type === "mcq" && question.options ? (
        <div role="radiogroup" aria-label="Answer options" className="mt-6 flex flex-col gap-3">
          {question.options.map((o, i) => {
            const selected = answer.selected === i
            return (
              <button
                key={i} type="button" role="radio" aria-checked={selected} onClick={() => onChange({ ...answer, selected: i })}
                className={cn(
                  "focus-ring flex min-h-14 w-full items-center gap-3 rounded-control border px-4 py-3 text-left transition-colors duration-[160ms]",
                  selected ? "border-action bg-action-tint" : "border-hairline bg-canvas hover:bg-mist"
                )}
              >
                <span className={cn("t-footnote inline-flex size-6 shrink-0 items-center justify-center rounded-full border", selected ? "border-action bg-action text-white" : "border-hairline text-ink-2")}>{i + 1}</span>
                <span className="t-body text-ink">{o}</span>
              </button>
            )
          })}
        </div>
      ) : (
        <div className="mt-6">
          <Textarea
            aria-label="Your answer" placeholder="Write your answer here" value={answer.text} className="min-h-40 text-[16px]"
            onChange={(e) => onChange({ ...answer, text: e.target.value })} onBlur={onBlurText}
          />
          <p className="t-footnote tabular mt-2 text-right text-ink-2">{answer.text.length} / 5000</p>
        </div>
      )}

      <div className="mt-8 flex items-center justify-between gap-3">
        <Button variant="secondary" className="h-12 min-w-24" onClick={onBack} disabled={index === 0}>Back</Button>
        <Button className="h-12 min-w-32" onClick={onNext}>{nextLabel}</Button>
      </div>
      <p className="t-footnote mt-3 h-4 text-right text-ink-2" aria-live="polite">{SAVE_TEXT[saveStatus]}</p>
    </div>
  )
}
