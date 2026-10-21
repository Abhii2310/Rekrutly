"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import type { PortalQuestion } from "./api"

export function ReviewScreen({
  questions, answered, onJump, onBack, onSubmit, submitting, error,
}: {
  questions: PortalQuestion[]
  answered: boolean[]
  onJump: (i: number) => void
  onBack: () => void
  onSubmit: () => void
  submitting: boolean
  error: string | null
}) {
  const [confirm, setConfirm] = React.useState(false)
  const missing = questions.map((q, i) => ({ q, i })).filter(({ i }) => !answered[i])

  return (
    <div>
      <h1 className="t-large text-ink">Review and submit</h1>
      {missing.length === 0 ? (
        <p className="t-body mt-2 text-ink-2">You answered every question.</p>
      ) : (
        <>
          <p className="t-body mt-2 text-ink-2">You haven&apos;t answered {missing.length === 1 ? "this question" : `these ${missing.length} questions`} yet.</p>
          <ul className="mt-5 flex flex-col">
            {missing.map(({ i }) => (
              <li key={i}>
                <button type="button" onClick={() => onJump(i)} className="focus-ring t-body flex min-h-12 w-full items-center rounded-control text-left text-action hover:text-action-hover">
                  Question {i + 1}
                </button>
              </li>
            ))}
          </ul>
        </>
      )}

      {error ? <p role="alert" className="t-callout mt-4 text-danger">{error}</p> : null}
      <div className="mt-8 flex items-center justify-between gap-3">
        <Button variant="secondary" className="h-12 min-w-24" onClick={onBack}>Back</Button>
        <Button className="h-12 min-w-40" onClick={() => setConfirm(true)}>Submit assessment</Button>
      </div>

      <Dialog open={confirm} onOpenChange={setConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Submit your answers?</DialogTitle>
            <DialogDescription>You can&apos;t change answers after submitting.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="plain" onClick={() => setConfirm(false)}>Keep going</Button>
            <Button loading={submitting} onClick={() => { onSubmit() }}>Submit</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
