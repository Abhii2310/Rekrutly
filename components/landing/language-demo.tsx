"use client"

import * as React from "react"
import { AnimatePresence, motion, useInView, useReducedMotion } from "motion/react"
import { cn } from "cn"
import { useTicker } from "./use-ticker"

const LANGS = [
  { key: "en", label: "English", text: "Hi Kabir, your Full-Stack Developer assessment is ready. It takes about 30 minutes, and your link works until 28 Oct. Thank you, the hiring team." },
  { key: "hi", label: "हिन्दी", text: "नमस्ते Kabir, आपका Full-Stack Developer आकलन तैयार है। इसमें लगभग 30 मिनट लगते हैं और आपका लिंक 28 Oct तक चलेगा। धन्यवाद, हायरिंग टीम।" },
  { key: "kn", label: "ಕನ್ನಡ", text: "ನಮಸ್ಕಾರ Kabir, ನಿಮ್ಮ Full-Stack Developer ಮೌಲ್ಯಮಾಪನ ಸಿದ್ಧವಾಗಿದೆ. ಇದಕ್ಕೆ ಸುಮಾರು 30 ನಿಮಿಷ ಬೇಕು, ನಿಮ್ಮ ಲಿಂಕ್ 28 Oct ವರೆಗೆ ಇರುತ್ತದೆ. ಧನ್ಯವಾದಗಳು, ನೇಮಕಾತಿ ತಂಡ." },
] as const

/** A follow-up draft switching between English, Hindi and Kannada. A sample message; real drafts are written on demand. */
export function LanguageDemo() {
  const ref = React.useRef<HTMLDivElement>(null)
  const visible = useInView(ref, { margin: "-10%" })
  const reduce = useReducedMotion()
  const tick = useTicker(90, 0, visible, 100)
  const idx = Math.floor(tick / 30) % LANGS.length
  const lang = LANGS[idx] ?? LANGS[0]
  return (
    <div ref={ref} className="rounded-[18px] border border-hairline/70 bg-canvas p-5 text-left sm:p-7">
      <div role="presentation" className="inline-flex rounded-[10px] bg-mist p-0.5">
        {LANGS.map((l, i) => (
          <span key={l.key} className={cn("t-callout rounded-[8px] px-3.5 py-1.5 transition-colors duration-300", i === idx ? "bg-canvas font-medium text-ink" : "text-ink-2")}>{l.label}</span>
        ))}
      </div>
      <div className="mt-4 min-h-[132px] rounded-[14px] bg-mist px-4 py-4">
        <AnimatePresence mode="wait" initial={false}>
          <motion.p
            key={lang.key}
            lang={lang.key}
            className="t-body text-ink"
            initial={reduce ? false : { opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduce ? { opacity: 1 } : { opacity: 0, y: -6 }}
            transition={{ duration: 0.28, ease: [0.32, 0.72, 0, 1] }}
          >
            {lang.text}
          </motion.p>
        </AnimatePresence>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <span className="t-callout inline-flex h-8 items-center rounded-full bg-fog px-3.5 text-ink">Copy message</span>
        <span className="t-callout inline-flex h-8 items-center rounded-full bg-fog px-3.5 text-ink">Open in WhatsApp</span>
        <span className="t-callout text-ink-2">You press send. Rekrutly never does.</span>
      </div>
    </div>
  )
}
