"use client"

import { Mic } from "lucide-react"
import { cn } from "cn"

/** Round mic button with a quiet pulsing ring while listening. Render it only when speech is supported. */
export function MicButton({ listening, onClick, className }: { listening: boolean; onClick: () => void; className?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={listening}
      aria-label={listening ? "Stop listening" : "Speak your instruction"}
      className={cn("focus-ring relative inline-flex size-9 items-center justify-center rounded-full text-ink-2 transition-colors duration-[160ms] hover:bg-mist hover:text-ink", listening && "text-action", className)}
    >
      {listening ? <span aria-hidden className="mic-ring absolute inset-0 rounded-full border border-action" /> : null}
      <Mic aria-hidden className="size-[18px]" strokeWidth={1.75} />
    </button>
  )
}
