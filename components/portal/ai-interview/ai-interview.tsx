"use client"

import * as React from "react"
import { Mic, Volume2 } from "lucide-react"
import { cn } from "cn"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { portalFetch } from "../api"
import { PortalShell } from "../shell"
import { canListen, canSpeak, createListener, speak, stopSpeaking, type Listener } from "./voice"

type State = { status: "none" | "in_progress" | "completed"; total: number; index: number; prompt: { text: string; kind: "question" | "followup" } | null }
type Phase = "intro" | "starting" | "speaking" | "listening" | "typing" | "thinking" | "done"

/**
 * A short conversation with an AI interviewer, right after the assessment. The AI speaks each question and shows it as
 * captions; the candidate answers by voice or by typing. Only text is sent. A person reads the result.
 */
export function AiInterview({ token, firstName, initial, onDone }: { token: string; firstName: string; initial: "none" | "in_progress" | "completed"; onDone: () => void }) {
  const [phase, setPhase] = React.useState<Phase>("intro")
  const [state, setState] = React.useState<State | null>(null)
  const [heard, setHeard] = React.useState("")
  const [typed, setTyped] = React.useState("")
  const [agreed, setAgreed] = React.useState(false)
  const [useVoice, setUseVoice] = React.useState(true)
  const [note, setNote] = React.useState<string | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const listener = React.useRef<Listener | null>(null)
  const listening = canListen()
  const talks = canSpeak()
  const voiceIn = useVoice && listening
  const alive = React.useRef(true)
  React.useEffect(() => () => { alive.current = false; stopSpeaking(); listener.current?.stop() }, [])

  const ask = React.useCallback(async (prompt: { text: string }) => {
    if (!alive.current) return
    setHeard("")
    setTyped("")
    setNote(null)
    setPhase("speaking")
    await speak(prompt.text)
    if (!alive.current) return
    if (voiceIn) listen()
    else setPhase("typing")
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [voiceIn])

  function listen() {
    const l = createListener({
      onInterim: setHeard,
      onFinal: (text) => { void send(text, false) },
      onError: (kind) => {
        if (!alive.current) return
        setPhase("typing")
        setNote(kind === "denied" ? "The microphone is blocked, so please type your answer. You can allow it in your browser settings." : kind === "none" ? "I didn't catch anything. Tap the microphone to try again, or type your answer." : "Listening stopped. Tap the microphone to try again, or type.")
      },
    })
    if (!l) { setPhase("typing"); return }
    listener.current = l
    setPhase("listening")
    try { l.start() } catch { setPhase("typing") }
  }

  async function send(text: string, skipped: boolean) {
    if (phase === "thinking") return
    listener.current?.stop()
    stopSpeaking()
    setPhase("thinking")
    setError(null)
    const res = await portalFetch<{ state: State; done: boolean }>(token, "/interview/answer", { method: "POST", body: JSON.stringify({ text, skipped }) }, 45_000)
    if (!alive.current) return
    if (!res.ok) { setError(res.message || "Couldn't send that. Check your connection and try again."); setPhase("typing"); return }
    setState(res.data.state)
    if (res.data.done || !res.data.state.prompt) { setPhase("done"); stopSpeaking(); return void onDone() }
    void ask(res.data.state.prompt)
  }

  async function begin() {
    setPhase("starting")
    setError(null)
    const res = await portalFetch<State>(token, "/interview/start", { method: "POST" }, 60_000)
    if (!res.ok) { setPhase("intro"); setError(res.message || "Couldn't start. Check your connection and try again."); return }
    setState(res.data)
    if (res.data.status === "completed" || !res.data.prompt) { setPhase("done"); return void onDone() }
    void ask(res.data.prompt)
  }

  const prompt = state?.prompt?.text ?? ""

  if (phase === "intro" || phase === "starting") {
    return (
      <PortalShell>
        <h1 className="t-large text-ink">{initial === "in_progress" ? "Let&apos;s carry on." : `Thanks, ${firstName}. One more step.`}</h1>
        <p className="t-body mt-2 text-ink-2">A short conversation with our AI interviewer, about 10 minutes. It asks a few questions about your own experience and your test, and listens to your answers.</p>
        <section className="mt-8 rounded-group bg-mist p-5">
          <h2 className="t-headline text-ink">Before we start</h2>
          <ul className="t-callout mt-3 flex flex-col gap-2 text-ink-2">
            <li>It speaks each question aloud and shows it on screen. Answer out loud, or type if you prefer.</li>
            <li>Your browser may ask to use the microphone. Your browser&apos;s own speech service turns your voice into words (in Chrome, Google does this). We receive and keep only the words as text. We never store audio, and no audio goes to our AI.</li>
            <li>There are no trick questions. If you are not sure, say what you would do.</li>
            <li>A person reads your answers. Nothing is decided automatically.</li>
          </ul>
          {listening ? (
            <label className="mt-4 flex min-h-11 cursor-pointer items-center gap-3">
              <input type="checkbox" checked={useVoice} onChange={(e) => setUseVoice(e.target.checked)} className="focus-ring size-5 shrink-0 accent-[var(--color-action)]" />
              <span className="t-body text-ink">Answer with my voice</span>
            </label>
          ) : <p className="t-callout mt-4 text-ink-2">This browser can&apos;t listen, so you will type your answers. Chrome on a laptop or an Android phone lets you speak.</p>}
          {!talks ? <p className="t-callout mt-2 text-ink-2">This browser can&apos;t speak the questions aloud, so you will read them on screen.</p> : null}
          <label className="mt-3 flex min-h-11 cursor-pointer items-center gap-3">
            <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} className="focus-ring size-5 shrink-0 accent-[var(--color-action)]" />
            <span className="t-body text-ink">I understand this is an AI interview</span>
          </label>
        </section>
        {error ? <p role="alert" className="t-callout mt-4 text-danger">{error}</p> : null}
        <div className="mt-6"><Button className="h-12 w-full sm:w-auto sm:px-8" loading={phase === "starting"} disabled={!agreed} onClick={() => void begin()}>Start the conversation</Button></div>
        <p className="t-callout mt-3 text-ink-2">Preparing your questions can take a few seconds.</p>
      </PortalShell>
    )
  }

  if (phase === "done") {
    return (
      <PortalShell>
        <div className="pt-10 sm:pt-16">
          <h1 className="t-title text-ink">Thank you, {firstName}.</h1>
          <p className="t-body mt-2 text-ink-2">That&apos;s everything. A person on the hiring team will read your answers and email you about the next steps. You can close this page.</p>
        </div>
      </PortalShell>
    )
  }

  const orb = phase === "speaking" ? "animate-pulse bg-action" : phase === "listening" ? "bg-success shadow-[0_0_0_14px_rgba(48,209,88,0.15)]" : phase === "thinking" ? "animate-pulse bg-ink-3" : "bg-fog"
  return (
    <PortalShell progress={state && state.total > 0 ? Math.min(state.index, state.total) / state.total : 0}>
      <p className="t-callout text-ink-2" aria-live="polite">
        Question {Math.min(state?.index ?? 1, state?.total ?? 1)} of {state?.total ?? 1}
        {state?.prompt?.kind === "followup" ? ", a follow-up" : ""}
      </p>

      <div className="mt-8 flex flex-col items-center text-center">
        <div aria-hidden className={cn("size-20 rounded-full transition-all duration-300", orb)} />
        <p className="t-footnote mt-4 text-ink-2" role="status">
          {phase === "speaking" ? "The interviewer is speaking" : phase === "listening" ? "Listening. Speak your answer." : phase === "thinking" ? "Thinking…" : "Your turn to answer"}
        </p>
        <p className="t-title mt-6 max-w-[520px] text-ink">{prompt}</p>
      </div>

      {phase === "listening" || (phase === "typing" && voiceIn && heard) ? (
        <div className="mt-8 min-h-20 rounded-group bg-mist p-4" aria-live="polite">
          <p className="t-callout text-ink-2">What I&apos;m hearing</p>
          <p className="t-body mt-1 text-ink">{heard || "…"}</p>
        </div>
      ) : null}

      {phase === "typing" ? (
        <div className="mt-8">
          <Textarea aria-label="Your answer" value={typed} onChange={(e) => setTyped(e.target.value)} placeholder="Type your answer" className="min-h-32 text-[16px]" autoFocus />
        </div>
      ) : null}

      {note ? <p className="t-callout mt-4 text-ink-2" role="status">{note}</p> : null}
      {error ? <p role="alert" className="t-callout mt-4 text-danger">{error}</p> : null}

      <div className="mt-6 flex flex-wrap items-center gap-3">
        {phase === "listening" ? <Button onClick={() => listener.current?.stop()}>I&apos;m done answering</Button> : null}
        {phase === "typing" ? <Button disabled={typed.trim().length < 2} onClick={() => void send(typed, false)}>Send answer</Button> : null}
        {phase === "typing" && voiceIn ? <Button variant="secondary" onClick={() => listen()}><Mic aria-hidden className="size-4" strokeWidth={1.75} />Speak instead</Button> : null}
        {phase === "listening" ? <Button variant="secondary" onClick={() => { listener.current?.stop(); setPhase("typing") }}>Type instead</Button> : null}
        {(phase === "listening" || phase === "typing") && talks ? <Button variant="plain" onClick={() => { listener.current?.stop(); void ask({ text: prompt }) }}><Volume2 aria-hidden className="size-4" strokeWidth={1.75} />Repeat the question</Button> : null}
        {phase === "listening" || phase === "typing" ? <Button variant="plain" onClick={() => void send("", true)}>Skip this question</Button> : null}
      </div>
    </PortalShell>
  )
}
