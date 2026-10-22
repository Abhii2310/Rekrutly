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

function pickVoice(): SpeechSynthesisVoice | undefined {
  const voices = window.speechSynthesis.getVoices()
  const rank = (v: SpeechSynthesisVoice): number => {
    const lang = v.lang.replace("_", "-").toLowerCase()
    const base = lang === "en-in" ? 0 : lang === "en-gb" ? 1 : lang === "en-us" ? 2 : lang.startsWith("en") ? 3 : 9
    return base * 2 + (/google|samantha|natural|neural|veena|rishi/i.test(v.name) ? 0 : 1)
  }
  return [...voices].filter((v) => v.lang.toLowerCase().startsWith("en")).sort((a, b) => rank(a) - rank(b))[0]
}

/** Splits into sentences, because some browsers stop a long utterance after about 15 seconds. */
const sentences = (text: string): string[] => text.match(/[^.!?]+[.!?]*/g)?.map((s) => s.trim()).filter(Boolean) ?? [text]

let speaking = 0

/** Reads the text aloud and resolves when it is finished (or after a safety timeout). Resolves at once if speech is unavailable. */
export function speak(text: string): Promise<void> {
  if (!canSpeak()) return Promise.resolve()
  const synth = window.speechSynthesis
  synth.cancel()
  const token = ++speaking
  return new Promise((resolve) => {
    const parts = sentences(text)
    let finished = false
    const done = () => { if (!finished) { finished = true; resolve() } }
    const safety = setTimeout(done, text.length * 110 + 5000)
    const next = (i: number) => {
      if (token !== speaking || i >= parts.length) { clearTimeout(safety); return done() }
      const u = new SpeechSynthesisUtterance(parts[i])
      const v = pickVoice()
      if (v) { u.voice = v; u.lang = v.lang } else u.lang = "en-IN"
      u.rate = 0.97
      u.onend = () => next(i + 1)
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
