import { rankVoice, spokenText, splitSentences } from "@/lib/ai-interview/speech"

/** The browser's own speech: it reads questions aloud and turns the candidate's speech into text. No audio leaves the device. */

type Recognition = {
  lang: string; continuous: boolean; interimResults: boolean
  start: () => void; stop: () => void; abort: () => void
  onresult: ((e: { resultIndex: number; results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null
  onerror: ((e: { error: string }) => void) | null
  onend: (() => void) | null
}
type RecognitionCtor = new () => Recognition

const recognitionCtor = (): RecognitionCtor | null => {
  if (typeof window === "undefined") return null
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}

export const canListen = (): boolean => recognitionCtor() !== null
export const canSpeak = (): boolean => typeof window !== "undefined" && "speechSynthesis" in window

/** English voices available on this device, best sounding first. */
export function listVoices(): SpeechSynthesisVoice[] {
  if (!canSpeak()) return []
  return window.speechSynthesis.getVoices().filter((v) => v.lang.toLowerCase().startsWith("en")).sort((a, b) => rankVoice(a.name, a.lang) - rankVoice(b.name, b.lang))
}

const VOICE_KEY = "rekrutly-voice"
export function savedVoiceName(): string | null {
  try { return sessionStorage.getItem(VOICE_KEY) } catch { return null }
}
export function saveVoiceName(name: string): void {
  try { sessionStorage.setItem(VOICE_KEY, name) } catch { /* a private window: the choice just is not remembered */ }
}

function pickVoice(): SpeechSynthesisVoice | undefined {
  const voices = listVoices()
  const saved = savedVoiceName()
  return voices.find((v) => v.name === saved) ?? voices[0]
}

let speaking = 0

export type SpeakOptions = {
  /** Called as each sentence starts, so the screen can highlight what is being said. */
  onSentence?: (index: number) => void
  /** Called at each word the voice reaches, so the avatar's mouth can move with it. */
  onWord?: () => void
}

/** Reads the text aloud, sentence by sentence, and resolves when finished (or after a safety timeout). Resolves at once if speech is unavailable. */
export function speak(text: string, opts: SpeakOptions = {}): Promise<void> {
  if (!canSpeak()) return Promise.resolve()
  const synth = window.speechSynthesis
  synth.cancel()
  const token = ++speaking
  return new Promise((resolve) => {
    const shown = splitSentences(text)
    const parts = shown.map((s) => spokenText(s))
    let finished = false
    const done = () => { if (!finished) { finished = true; resolve() } }
    const safety = setTimeout(done, text.length * 120 + 6000)
    const next = (i: number) => {
      if (token !== speaking || i >= parts.length) { clearTimeout(safety); return done() }
      opts.onSentence?.(i)
      const u = new SpeechSynthesisUtterance(parts[i])
      const v = pickVoice()
      if (v) { u.voice = v; u.lang = v.lang } else u.lang = "en-IN"
      u.rate = 0.92
      u.pitch = 1.05
      u.volume = 1
      u.onboundary = () => opts.onWord?.()
      u.onend = () => setTimeout(() => next(i + 1), 160)
      u.onerror = () => next(i + 1)
      synth.speak(u)
    }
    next(0)
  })
}

export function stopSpeaking() {
  speaking++
  if (canSpeak()) window.speechSynthesis.cancel()
}

export type Listener = { start: () => void; stop: () => void }

/**
 * Listens for one answer. It ends by itself after a pause in speech (`silenceMs`), or when stopped, and hands back the words
 * it heard. `onInterim` shows the words as they come, so the candidate can see they were heard.
 */
export function createListener(opts: { silenceMs?: number; noSpeechMs?: number; onInterim: (text: string) => void; onFinal: (text: string) => void; onError: (kind: "denied" | "none" | "other") => void }): Listener | null {
  const Ctor = recognitionCtor()
  if (!Ctor) return null
  const silenceMs = opts.silenceMs ?? 2600
  const noSpeechMs = opts.noSpeechMs ?? 14_000
  let rec: Recognition | null = null
  let active = false
  let finalText = ""
  let interim = ""
  let silenceTimer: ReturnType<typeof setTimeout> | null = null
  let noSpeechTimer: ReturnType<typeof setTimeout> | null = null

  const clear = () => { if (silenceTimer) clearTimeout(silenceTimer); if (noSpeechTimer) clearTimeout(noSpeechTimer); silenceTimer = noSpeechTimer = null }
  const finish = () => {
    if (!active) return
    active = false
    clear()
    try { rec?.stop() } catch { /* already stopped */ }
    const text = `${finalText} ${interim}`.replace(/\s+/g, " ").trim()
    if (text) opts.onFinal(text); else opts.onError("none")
  }

  return {
    start() {
      if (active) return
      active = true
      finalText = ""
      interim = ""
      const begin = () => {
        rec = new Ctor()
        rec.lang = "en-IN"
        rec.continuous = true
        rec.interimResults = true
        rec.onresult = (e) => {
          interim = ""
          for (let i = e.resultIndex; i < e.results.length; i++) {
            const r = e.results[i] as ArrayLike<{ transcript: string }> & { isFinal: boolean }
            const t = r[0]?.transcript ?? ""
            if (r.isFinal) finalText += ` ${t}`; else interim += t
          }
          opts.onInterim(`${finalText} ${interim}`.replace(/\s+/g, " ").trim())
          if (noSpeechTimer) { clearTimeout(noSpeechTimer); noSpeechTimer = null }
          if (silenceTimer) clearTimeout(silenceTimer)
          silenceTimer = setTimeout(finish, silenceMs)
        }
        rec.onerror = (e) => {
          if (e.error === "not-allowed" || e.error === "service-not-allowed") { active = false; clear(); opts.onError("denied") }
          else if (e.error !== "no-speech" && e.error !== "aborted") { active = false; clear(); opts.onError("other") }
        }
        // The browser ends a session now and then. If we are still listening, start again.
        rec.onend = () => { if (active) { try { begin() } catch { active = false; opts.onError("other") } } }
        rec.start()
      }
      begin()
      noSpeechTimer = setTimeout(finish, noSpeechMs)
    },
    stop() { finish() },
  }
}
