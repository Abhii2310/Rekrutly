"use client"

import * as React from "react"
import { Skeleton } from "@/components/ui/skeleton"
import { formatTime } from "@/lib/format"
import { portalFetch, type AnswerState, type PortalInfo, type QuestionsPayload } from "./api"
import { Intro } from "./intro"
import { Navigator, QuestionScreen } from "./question-screen"
import { ReviewScreen } from "./review-screen"
import { PortalShell, StateMessage } from "./shell"
import { TimerPill } from "./timer-pill"
import { useAutosave } from "./use-autosave"
import { useSignals } from "./use-signals"

type Load = { name: "loading" } | { name: "network" } | { name: "invalid" } | { name: "ready"; info: PortalInfo }

export function PortalApp({ token }: { token: string }) {
  const [load, setLoad] = React.useState<Load>({ name: "loading" })
  const [qs, setQs] = React.useState<QuestionsPayload | null>(null)
  const [answers, setAnswers] = React.useState<Record<string, AnswerState>>({})
  const [index, setIndex] = React.useState(0)
  const [offset, setOffset] = React.useState(0)
  const [secondsLeft, setSecondsLeft] = React.useState<number | null>(null)
  const [starting, setStarting] = React.useState(false)
  const [startError, setStartError] = React.useState<string | null>(null)
  const [submitting, setSubmitting] = React.useState(false)
  const [submitError, setSubmitError] = React.useState<string | null>(null)
  const finishing = React.useRef(false)

  const loadInfo = React.useCallback(async (): Promise<PortalInfo | null> => {
    const res = await portalFetch<PortalInfo>(token, "")
    if (res.ok) { setLoad({ name: "ready", info: res.data }); return res.data }
    setLoad(res.status === 404 ? { name: "invalid" } : { name: "network" })
    return null
  }, [token])

  const loadQuestions = React.useCallback(async () => {
    const res = await portalFetch<QuestionsPayload>(token, "/questions")
    if (!res.ok) { await loadInfo(); return }
    setQs(res.data)
    setOffset(Date.parse(res.data.serverNow) - Date.now())
    setAnswers(Object.fromEntries(res.data.answers.map((a) => [a.question_id, { selected: a.selected_option, text: a.text_answer ?? "" }])))
    const total = res.data.questions.length
    setIndex(Math.min(Math.max((res.data.currentQuestion ?? 1) - 1, 0), Math.max(total - 1, 0)))
  }, [token, loadInfo])

  React.useEffect(() => {
    void (async () => {
      const info = await loadInfo()
      if (info?.state === "in_progress") await loadQuestions()
    })()
  }, [loadInfo, loadQuestions])

  const onClosed = React.useCallback(() => { void loadInfo() }, [loadInfo])
  const autosave = useAutosave(token, onClosed)
  const inProgress = load.name === "ready" && load.info.state === "in_progress" && qs !== null
  const { flushSignals } = useSignals(token, inProgress)

  const total = qs?.questions.length ?? 0
  const answered = React.useMemo(
    () => (qs?.questions ?? []).map((q) => {
      const a = answers[q.id]
      return q.type === "mcq" ? a?.selected !== undefined && a?.selected !== null : Boolean(a?.text.trim())
    }),
    [qs, answers],
  )

  async function submit(): Promise<void> {
    if (finishing.current) return
    finishing.current = true
    setSubmitting(true)
    setSubmitError(null)
    const saved = await autosave.flush()
    if (!saved) {
      setSubmitting(false)
      finishing.current = false
      setSubmitError("Couldn't save your last answers. Check your connection and try again.")
      return
    }
    flushSignals()
    const res = await portalFetch<{ submittedAt: string }>(token, "/submit", { method: "POST" }, 30_000)
    if (!res.ok && res.status !== 409) {
      setSubmitting(false)
      finishing.current = false
      setSubmitError("Couldn't submit. Check your connection and try again.")
      return
    }
    setSubmitting(false)
    await loadInfo()
  }

  // The clock: the server's deadline, corrected for the difference between the server's and this device's time.
  React.useEffect(() => {
    if (!qs) return
    const deadline = Date.parse(qs.deadlineAt)
    const tick = () => {
      const left = (deadline - (Date.now() + offset)) / 1000
      setSecondsLeft(left)
      if (left <= 0 && !finishing.current) void submit()
    }
    tick()
    const t = setInterval(tick, 1000)
    return () => clearInterval(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qs, offset])

  function setAnswer(i: number, next: AnswerState) {
    const q = qs?.questions[i]
    if (!q) return
    setAnswers((prev) => ({ ...prev, [q.id]: next }))
    autosave.save(q, next, i + 1)
  }

  const goTo = React.useCallback((i: number) => { void autosave.flush(); setIndex(Math.min(Math.max(i, 0), total)) }, [autosave, total])

  // Keys 1 to 4 pick an option; Enter moves on (unless a control already handles Enter).
  React.useEffect(() => {
    if (!inProgress || !qs) return
    const onKey = (e: KeyboardEvent) => {
      const t = e.target
      if (t instanceof HTMLTextAreaElement || t instanceof HTMLInputElement) return
      const q = qs.questions[index]
      if (q?.type === "mcq" && /^[1-9]$/.test(e.key) && q.options && Number(e.key) <= q.options.length) {
        setAnswer(index, { selected: Number(e.key) - 1, text: "" })
      } else if (e.key === "Enter" && !(t instanceof HTMLButtonElement) && index < total) {
        goTo(index + 1)
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inProgress, qs, index, total])

  async function start() {
    setStarting(true)
    setStartError(null)
    const res = await portalFetch<{ deadlineAt: string }>(token, "/start", { method: "POST", body: JSON.stringify({ consent: true }) }, 30_000)
    if (!res.ok) {
      setStarting(false)
      setStartError(res.status === 0 ? "Couldn't reach the server. Check your connection and try again." : res.message)
      if (res.status === 409) await loadInfo()
      return
    }
    await loadInfo()
    await loadQuestions()
    setStarting(false)
  }

  if (load.name === "loading") {
    return (
      <PortalShell>
        <Skeleton className="h-10 w-48" />
        <Skeleton className="mt-4 h-5 w-72" />
        <Skeleton className="mt-10 h-40 w-full" />
      </PortalShell>
    )
  }
  if (load.name === "network") return <StateMessage title="We couldn't load this page.">Check your connection, then reload the page.</StateMessage>
  if (load.name === "invalid") return <StateMessage title="This link isn't valid.">Check that you copied the whole link.</StateMessage>

  const info = load.info
  if (info.state === "expired") return <StateMessage title="This link has expired.">Ask the hiring team for a new one.</StateMessage>
  if (info.state === "revoked") return <StateMessage title="This link is no longer active.">Ask the hiring team if you think this is a mistake.</StateMessage>
  if (info.state === "submitted" || info.state === "time_up") {
    const at = info.submittedAt ? formatTime(info.submittedAt) : null
    return (
      <StateMessage title={info.autoSubmitted ? "Time is up." : "Submitted."}>
        {info.autoSubmitted ? "Your answers were submitted automatically" : "Your answers were received"}
        {at ? ` at ${at}` : ""}. You can close this page.
      </StateMessage>
    )
  }
  if (info.state === "ready") return <Intro info={info} onStart={start} starting={starting} error={startError} />

  if (!qs) {
    return (
      <PortalShell>
        <Skeleton className="h-6 w-40" />
        <Skeleton className="mt-6 h-24 w-full" />
        <Skeleton className="mt-4 h-14 w-full" />
        <Skeleton className="mt-3 h-14 w-full" />
      </PortalShell>
    )
  }

  const q = qs.questions[index]
  const onReview = index >= total
  return (
    <PortalShell
      right={secondsLeft !== null ? <TimerPill secondsLeft={secondsLeft} /> : null}
      progress={total > 0 ? Math.min(index + 1, total) / total : 0}
    >
      {onReview || !q ? (
        <ReviewScreen
          questions={qs.questions} answered={answered} onJump={goTo} onBack={() => goTo(total - 1)}
          onSubmit={() => void submit()} submitting={submitting} error={submitError}
        />
      ) : (
        <QuestionScreen
          key={q.id} question={q} index={index} total={total}
          answer={answers[q.id] ?? { selected: null, text: "" }}
          onChange={(a) => setAnswer(index, a)} onBlurText={() => void autosave.flush()}
          onBack={() => goTo(index - 1)} onNext={() => goTo(index + 1)}
          nextLabel={index === total - 1 ? "Review and submit" : "Next"} saveStatus={autosave.status}
        />
      )}
      {total > 0 ? <Navigator total={total} current={onReview ? -1 : index} answered={answered} onJump={goTo} /> : null}
    </PortalShell>
  )
}
