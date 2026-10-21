"use client"

import * as React from "react"

type Alt = { transcript: string }
type Result = ArrayLike<Alt> & { isFinal: boolean }
type SpeechEvent = { resultIndex: number; results: ArrayLike<Result> }
type SpeechErrorEvent = { error: string }
type Recognition = {
  lang: string
  interimResults: boolean
  continuous: boolean
  start: () => void
  stop: () => void
  abort: () => void
  onresult: ((e: SpeechEvent) => void) | null
  onerror: ((e: SpeechErrorEvent) => void) | null
  onend: (() => void) | null
}
type RecognitionCtor = new () => Recognition

function ctor(): RecognitionCtor | null {
  if (typeof window === "undefined") return null
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}

const noSubscribe = () => () => {}

/** True only in browsers that have speech recognition (Chrome, Edge, Safari). Firefox does not, so the mic is hidden there. */
export function useSpeechSupported(): boolean {
  return React.useSyncExternalStore(noSubscribe, () => ctor() !== null, () => false)
}

const MESSAGES: Record<string, string> = {
  "not-allowed": "Microphone access is blocked. Allow it in your browser settings, or type instead.",
  "service-not-allowed": "Microphone access is blocked. Allow it in your browser settings, or type instead.",
  "audio-capture": "No microphone was found. Type instead.",
  network: "Voice input needs an internet connection. Type instead.",
}

/** How long to wait for the first word, and how long a pause after speech means "done". Browsers cut off far sooner on their own. */
const FIRST_WORD_MS = 10_000
const PAUSE_MS = 3_500
const MIN_RUN_MS = 600

/**
 * Dictation in English (India), built to be forgiving. The browser's own timeout is a couple of seconds, so this keeps
 * listening (continuous), restarts the browser session if it ends on its own, and decides "done" itself: a pause of a few
 * seconds after speech, or a second tap. Words stream into `onText` as they are heard. It never submits anything.
 */
export function useSpeechInput(onText: (text: string) => void) {
  const supported = useSpeechSupported()
  const [listening, setListening] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const rec = React.useRef<Recognition | null>(null)
  const want = React.useRef(false)
  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null)
  const spoke = React.useRef(false)
  const lastText = React.useRef("")
  const quickEnds = React.useRef(0)
  const startedAt = React.useRef(0)
  const beginRef = React.useRef<() => void>(() => {})
  const onTextRef = React.useRef(onText)
  React.useEffect(() => { onTextRef.current = onText }, [onText])

  const clearTimer = () => { if (timer.current) { clearTimeout(timer.current); timer.current = null } }

  const finish = React.useCallback((message: string | null) => {
    want.current = false
    clearTimer()
    const r = rec.current
    rec.current = null
    if (r) { r.onend = null; r.onerror = null; r.onresult = null; try { r.stop() } catch { /* already stopped */ } }
    setListening(false)
    if (message) setError(message)
  }, [])

  const armTimer = React.useCallback(() => {
    clearTimer()
    timer.current = setTimeout(
      () => finish(spoke.current ? null : "Didn't hear anything. Tap the mic and try again."),
      spoke.current ? PAUSE_MS : FIRST_WORD_MS,
    )
  }, [finish])

  const begin = React.useCallback(() => {
    const Ctor = ctor()
    if (!Ctor) return
    const base = lastText.current
    const r = new Ctor()
    r.lang = "en-IN"
    r.interimResults = true
    r.continuous = true
    r.onresult = (e) => {
      const spoken = Array.from(e.results).map((x) => x[0]?.transcript ?? "").join("").trim()
      if (!spoken) return
      spoke.current = true
      lastText.current = base ? `${base} ${spoken}` : spoken
      onTextRef.current(lastText.current)
      armTimer()
    }
    r.onerror = (e) => {
      // "no-speech" and "aborted" are normal here: our own timer decides when to stop.
      if (e.error === "no-speech" || e.error === "aborted") return
      finish(MESSAGES[e.error] ?? "Voice input stopped. Try again, or type instead.")
    }
    r.onend = () => {
      // The browser ended the session by itself (they do, after a few seconds or a minute). Carry on unless we meant to stop.
      if (!want.current) return
      quickEnds.current = Date.now() - startedAt.current < MIN_RUN_MS ? quickEnds.current + 1 : 0
      if (quickEnds.current >= 3) return finish("Voice input keeps stopping. Type instead.")
      beginRef.current()
    }
    rec.current = r
    startedAt.current = Date.now()
    try { r.start() } catch { finish("Voice input couldn't start. Type instead.") }
  }, [armTimer, finish])
  React.useEffect(() => { beginRef.current = begin }, [begin])

  const toggle = React.useCallback((currentText: string) => {
    if (want.current) { finish(null); return }
    if (!ctor()) return
    want.current = true
    spoke.current = false
    quickEnds.current = 0
    lastText.current = currentText.trim()
    setError(null)
    setListening(true)
    armTimer()
    begin()
  }, [armTimer, begin, finish])

  React.useEffect(() => () => {
    want.current = false
    clearTimer()
    const r = rec.current
    if (r) { r.onend = null; r.abort() }
  }, [])

  return { supported, listening, error, toggle }
}
