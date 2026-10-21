"use client"

import * as React from "react"

type Alt = { transcript: string }
type SpeechEvent = { results: ArrayLike<ArrayLike<Alt>> }
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
  "no-speech": "Didn't hear anything. Tap the mic and try again.",
  "audio-capture": "No microphone was found. Type instead.",
  network: "Voice input needs an internet connection. Type instead.",
}

/**
 * Dictation in English (India). Interim words stream into `onText`. It stops on silence or a second tap
 * and never submits anything: the person presses Enter.
 */
export function useSpeechInput(onText: (text: string) => void) {
  const supported = useSpeechSupported()
  const [listening, setListening] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const rec = React.useRef<Recognition | null>(null)
  const onTextRef = React.useRef(onText)
  React.useEffect(() => { onTextRef.current = onText }, [onText])
  React.useEffect(() => () => rec.current?.abort(), [])

  const toggle = React.useCallback((currentText: string) => {
    if (rec.current) { rec.current.stop(); return }
    const Ctor = ctor()
    if (!Ctor) return
    const r = new Ctor()
    r.lang = "en-IN"
    r.interimResults = true
    r.continuous = false
    const base = currentText.trim()
    r.onresult = (e) => {
      const spoken = Array.from(e.results).map((x) => x[0]?.transcript ?? "").join("").trim()
      onTextRef.current(base ? `${base} ${spoken}` : spoken)
    }
    r.onerror = (e) => { if (e.error !== "aborted") setError(MESSAGES[e.error] ?? "Voice input stopped. Try again, or type instead.") }
    r.onend = () => { rec.current = null; setListening(false) }
    rec.current = r
    setError(null)
    setListening(true)
    try { r.start() } catch { rec.current = null; setListening(false); setError("Voice input couldn't start. Type instead.") }
  }, [])

  return { supported, listening, error, toggle }
}
