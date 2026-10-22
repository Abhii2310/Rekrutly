"use client"

import * as React from "react"
import { cn } from "cn"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { MAX_DELIVERABLE_CHARS, MAX_MESSAGE_CHARS } from "@/lib/ai-task/rules"
import { portalFetch } from "../api"
import { PortalShell } from "../shell"

type Msg = { role: "candidate" | "assistant"; text: string; at: string }
type State = {
  status: "none" | "in_progress" | "completed"
  task: { title: string; brief: string; deliverable: string } | null
  chat: Msg[]; draft: string; secondsLeft: number | null; messagesLeft: number; chatLength: number
  debrief: { wrongStatement: string; why: string; outcome: string } | null
}
type Phase = "intro" | "starting" | "working" | "debrief"

const clock = (s: number): string => `${Math.floor(s / 60)}:${String(Math.max(0, s % 60)).padStart(2, "0")}`

/**
 * A real work task with an AI assistant that is sometimes wrong. The candidate can use it however they like; what is recorded
 * is how they prompt, whether they check it against the brief, and what ends up in their answer. Afterwards they are told what
 * the assistant got wrong. A person reads the evidence; nothing is scored.
 */
export function AiTask({ token, firstName, initial, onDone }: { token: string; firstName: string; initial: "none" | "in_progress" | "completed"; onDone: () => void }) {
  const [phase, setPhase] = React.useState<Phase>(initial === "completed" ? "debrief" : "intro")
  const [state, setState] = React.useState<State | null>(null)
  const [message, setMessage] = React.useState("")
  const [answer, setAnswer] = React.useState("")
  const [sending, setSending] = React.useState(false)
  const [submitting, setSubmitting] = React.useState(false)
  const [confirm, setConfirm] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [deadline, setDeadline] = React.useState<number | null>(null)
  const [now, setNow] = React.useState(() => Date.now())
  const answerRef = React.useRef("")
  const submitRef = React.useRef<() => void>(() => {})
  const lastSaved = React.useRef("")
  const submitted = React.useRef(false)
  const endRef = React.useRef<HTMLDivElement>(null)

  function adopt(s: State) {
    setState(s)
    setDeadline(s.secondsLeft === null ? null : Date.now() + s.secondsLeft * 1000)
    if (s.status === "completed") setPhase("debrief")
  }

  // Coming back after a refresh: pick up where they were.
  React.useEffect(() => {
    if (initial === "none") return
    void (async () => {
      const res = await portalFetch<State>(token, "/task", { method: "GET" })
      if (res.ok) { adopt(res.data); setAnswer(res.data.draft); lastSaved.current = res.data.draft; if (res.data.status === "in_progress") setPhase("working") }
    })()
  }, [token, initial])

  async function begin() {
    setPhase("starting")
    setError(null)
    const res = await portalFetch<State>(token, "/task/start", { method: "POST" }, 60_000)
    if (!res.ok) { setPhase("intro"); return setError(res.message || "Couldn't start. Check your connection and try again.") }
    adopt(res.data)
    setAnswer(res.data.draft)
    if (res.data.status === "in_progress") setPhase("working")
  }

  async function sendMessage() {
    const text = message.trim()
    if (!text || sending || !state) return
    setSending(true)
    setError(null)
    // Show the candidate's message at once; the assistant's reply follows.
    setState({ ...state, chat: [...state.chat, { role: "candidate", text, at: new Date().toISOString() }] })
    setMessage("")
    const res = await portalFetch<State>(token, "/task/chat", { method: "POST", body: JSON.stringify({ text, chatLength: state.chatLength }) }, 60_000)
    setSending(false)
    if (!res.ok) { setError(res.message || "Couldn't send that. Try again."); setState(state); setMessage(text); return }
    setState(res.data)
  }

  const submit = React.useCallback(async (force = false) => {
    if (submitted.current && !force) return
    if (answer.trim().length < 20) { setError("Write your answer first (a couple of sentences)."); setConfirm(false); return }
    submitted.current = true
    setSubmitting(true)
    setError(null)
    const res = await portalFetch<State>(token, "/task/submit", { method: "POST", body: JSON.stringify({ text: answer }) }, 60_000)
    setSubmitting(false)
    if (!res.ok) { submitted.current = false; return setError(res.message || "Couldn't submit. Check your connection and try again.") }
    adopt(res.data)
  }, [answer, token])

  // The clock counts down on this page; the server decides when time is really up. When it reaches zero the answer is sent.
  React.useEffect(() => { answerRef.current = answer; submitRef.current = () => { void submit() } })
  React.useEffect(() => {
    if (phase !== "working" || deadline === null) return
    const t = setInterval(() => {
      const t2 = Date.now()
      setNow(t2)
      if (t2 >= deadline && answerRef.current.trim().length >= 20) submitRef.current()
    }, 1000)
    return () => clearInterval(t)
  }, [phase, deadline])
  const left = deadline === null ? null : Math.max(0, Math.round((deadline - now) / 1000))

  // Save the answer as they write.
  React.useEffect(() => {
    if (phase !== "working") return
    const t = setInterval(() => {
      if (answer !== lastSaved.current) { lastSaved.current = answer; void portalFetch(token, "/task/draft", { method: "POST", body: JSON.stringify({ text: answer }) }) }
    }, 8000)
    return () => clearInterval(t)
  }, [phase, answer, token])
  React.useEffect(() => { endRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" }) }, [state?.chat.length, sending])

  if (phase === "intro" || phase === "starting") {
    return (
      <PortalShell>
        <h1 className="t-large text-ink">{initial === "in_progress" ? "Let's carry on." : `Thanks, ${firstName}. A real work task.`}</h1>
        <p className="t-body mt-2 text-ink-2">Next is a short task, about 15 minutes, like a small piece of the real job. You get an AI assistant to use however you like.</p>
        <section className="mt-8 rounded-group bg-mist p-5">
          <h2 className="t-headline text-ink">How it works</h2>
          <ul className="t-callout mt-3 flex flex-col gap-2 text-ink-2">
            <li>Read the brief, ask the assistant for help if you want, and write your final answer. The answer is yours.</li>
            <li>Like any real tool, the assistant is helpful but <strong className="font-medium text-ink">it can be wrong</strong>. You are responsible for what you submit, so check it against the brief.</li>
            <li>We look at how you work with it: what you ask, whether you check things, and what you keep. At the end we tell you what it got wrong.</li>
            <li>A person reads this. Nothing is scored or decided automatically.</li>
          </ul>
        </section>
        {error ? <p role="alert" className="t-callout mt-4 text-danger">{error}</p> : null}
        <div className="mt-6"><Button className="h-12 w-full sm:w-auto sm:px-8" loading={phase === "starting"} onClick={() => void begin()}>Start the task</Button></div>
        <p className="t-callout mt-3 text-ink-2">Preparing your task can take a few seconds.</p>
      </PortalShell>
    )
  }

  if (phase === "debrief") {
    const d = state?.debrief
    return (
      <PortalShell>
        <h1 className="t-large text-ink">Task done. Here&apos;s the debrief.</h1>
        <p className="t-body mt-2 text-ink-2">This was not a trap to catch you out. AI tools state wrong things confidently, and checking them is a real skill.</p>
        {d ? (
          <section className="mt-8 rounded-group bg-mist p-5">
            <h2 className="t-headline text-ink">What the assistant got wrong</h2>
            <p className="t-body mt-2 text-ink">&ldquo;{d.wrongStatement}&rdquo;</p>
            <p className="t-callout mt-2 text-ink-2">{d.why}</p>
            <p className="t-callout mt-4 text-ink-2">What we saw in your work: <span className="text-ink">{d.outcome}.</span></p>
          </section>
        ) : null}
        <p className="t-callout mt-6 text-ink-2">A person on the hiring team will read how you worked and be in touch.</p>
        <div className="mt-6"><Button className="h-12 w-full sm:w-auto sm:px-8" onClick={onDone}>Continue</Button></div>
      </PortalShell>
    )
  }

  const wordCount = answer.trim() ? answer.trim().split(/\s+/).length : 0
  return (
    <PortalShell right={left !== null ? <span className={cn("t-callout tabular rounded-full px-3 py-1", left <= 120 ? "bg-warning-tint text-ink" : "bg-fog text-ink-2")}>{clock(left)}</span> : null}>
      <div className="grid gap-8 lg:grid-cols-2">
        <div className="min-w-0">
          <h1 className="t-title text-ink">{state?.task?.title}</h1>
          <p className="t-body mt-3 whitespace-pre-wrap text-ink">{state?.task?.brief}</p>
          <div className="mt-5 rounded-group bg-mist p-4"><p className="t-callout text-ink-2">Your job</p><p className="t-body mt-1 text-ink">{state?.task?.deliverable}</p></div>
          <label className="t-callout mt-5 flex flex-col gap-1.5 text-ink">
            Your final answer
            <Textarea aria-label="Your final answer" value={answer} maxLength={MAX_DELIVERABLE_CHARS} onChange={(e) => setAnswer(e.target.value)} className="min-h-44 text-[16px] leading-6" placeholder="Write your answer here. You can paste from the assistant, but it is your answer." />
          </label>
          <p className="t-footnote mt-1 text-ink-2">{wordCount} {wordCount === 1 ? "word" : "words"}</p>
        </div>

        <div className="flex min-w-0 flex-col">
          <h2 className="t-headline text-ink">AI assistant</h2>
          <p className="t-footnote text-ink-2">Helpful, but it can make mistakes. {state ? `${state.messagesLeft} messages left.` : ""}</p>
          <div className="mt-3 flex h-[340px] flex-col gap-3 overflow-y-auto rounded-group bg-mist p-4" aria-live="polite">
            {state && state.chat.length === 0 ? <p className="t-callout text-ink-2">Ask for help with the task, or skip it and write your answer yourself.</p> : null}
            {state?.chat.map((m, i) => (
              <div key={i} className={cn("max-w-[88%] whitespace-pre-wrap rounded-[14px] px-3.5 py-2.5 t-callout", m.role === "candidate" ? "ml-auto bg-ink text-canvas" : "bg-canvas text-ink")}>{m.text}</div>
            ))}
            {sending ? <div className="t-callout rounded-[14px] bg-canvas px-3.5 py-2.5 text-ink-2">Assistant is typing…</div> : null}
            <div ref={endRef} />
          </div>
          <div className="mt-3 flex items-end gap-2">
            <Textarea aria-label="Message to the assistant" value={message} maxLength={MAX_MESSAGE_CHARS} onChange={(e) => setMessage(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void sendMessage() } }} className="min-h-12 flex-1 text-[15px]" placeholder="Message the assistant" disabled={!state || state.messagesLeft === 0} />
            <Button loading={sending} disabled={!message.trim() || !state || state.messagesLeft === 0} onClick={() => void sendMessage()}>Send</Button>
          </div>
        </div>
      </div>

      {error ? <p role="alert" className="t-callout mt-4 text-danger">{error}</p> : null}
      <div className="mt-8 border-t border-hairline/60 pt-5">
        {confirm ? (
          <div className="rounded-group bg-mist p-4">
            <p className="t-body text-ink">Submit your answer? You can&apos;t change it afterwards.</p>
            <div className="mt-3 flex gap-2"><Button loading={submitting} onClick={() => void submit()}>Yes, submit</Button><Button variant="secondary" onClick={() => setConfirm(false)}>Keep working</Button></div>
          </div>
        ) : <Button className="h-12 px-8" disabled={answer.trim().length < 20} onClick={() => setConfirm(true)}>Submit my answer</Button>}
      </div>
    </PortalShell>
  )
}
