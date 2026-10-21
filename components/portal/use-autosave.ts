"use client"

import * as React from "react"
import { portalFetch, type AnswerState, type PortalQuestion } from "./api"

export type SaveStatus = "idle" | "saving" | "saved" | "retrying"

const BACKOFF_MS = [1000, 2000, 4000, 8000, 15000]
const TEXT_DEBOUNCE_MS = 600

/**
 * Autosave with a queue: multiple-choice answers save at once, text is debounced 600ms and flushed on blur,
 * navigation and submit. A failed save retries with exponential backoff and keeps the answer on screen.
 */
export function useAutosave(token: string, onClosed: () => void) {
  const [status, setStatus] = React.useState<SaveStatus>("idle")
  const latest = React.useRef(new Map<string, { q: PortalQuestion; answer: AnswerState; index: number }>())
  const dirty = React.useRef(new Set<string>())
  const timers = React.useRef(new Map<string, ReturnType<typeof setTimeout>>())
  const retryTimer = React.useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const running = React.useRef<Promise<void> | null>(null)
  const attempt = React.useRef(0)
  const closed = React.useRef(false)
  const runRef = React.useRef<() => Promise<void>>(async () => {})

  const saveOne = React.useCallback(async (qid: string): Promise<boolean> => {
    const item = latest.current.get(qid)
    if (!item) return true
    const body = item.q.type === "mcq"
      ? { questionId: qid, selectedOption: item.answer.selected, currentQuestion: item.index }
      : { questionId: qid, textAnswer: item.answer.text, currentQuestion: item.index }
    const res = await portalFetch<{ savedAt: string }>(token, "/answers", { method: "PUT", body: JSON.stringify(body) })
    if (res.ok) {
      // Only clear it if nothing newer arrived while the request was in flight.
      if (latest.current.get(qid)?.answer === item.answer) dirty.current.delete(qid)
      return true
    }
    if (res.status === 409) { closed.current = true; dirty.current.clear(); onClosed(); return true }
    return false
  }, [token, onClosed])

  const run = React.useCallback((): Promise<void> => {
    if (running.current) return running.current
    const p = (async () => {
      clearTimeout(retryTimer.current)
      while (dirty.current.size > 0 && !closed.current) {
        setStatus("saving")
        let failed = false
        for (const qid of [...dirty.current]) {
          if (!(await saveOne(qid))) failed = true
        }
        if (failed) {
          setStatus("retrying")
          const wait = BACKOFF_MS[Math.min(attempt.current++, BACKOFF_MS.length - 1)] ?? 15000
          retryTimer.current = setTimeout(() => { running.current = null; void runRef.current() }, wait)
          return
        }
      }
      attempt.current = 0
      if (!closed.current) setStatus("saved")
    })().finally(() => { if (running.current === p) running.current = null })
    running.current = p
    return p
  }, [saveOne])

  React.useEffect(() => { runRef.current = run }, [run])

  const save = React.useCallback((q: PortalQuestion, answer: AnswerState, index: number) => {
    latest.current.set(q.id, { q, answer, index })
    dirty.current.add(q.id)
    clearTimeout(timers.current.get(q.id))
    if (q.type === "mcq") { void run(); return }
    setStatus("saving")
    timers.current.set(q.id, setTimeout(() => void run(), TEXT_DEBOUNCE_MS))
  }, [run])

  /** Saves everything still waiting. Used before moving on, submitting, or when time runs out. */
  const flush = React.useCallback(async (): Promise<boolean> => {
    for (const t of timers.current.values()) clearTimeout(t)
    timers.current.clear()
    clearTimeout(retryTimer.current)
    if (running.current) await running.current
    if (dirty.current.size > 0 && !closed.current) {
      running.current = null
      await run()
      if (running.current) await running.current
    }
    return dirty.current.size === 0
  }, [run])

  React.useEffect(() => () => {
    clearTimeout(retryTimer.current)
    for (const t of timers.current.values()) clearTimeout(t)
  }, [])

  return { status, save, flush }
}
