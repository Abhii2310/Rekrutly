"use client"

import * as React from "react"
import { cn } from "cn"

type Option<V extends string> = { value: V; label: string }

export function SegmentedControl<V extends string>({
  options, value, onChange, ariaLabel, className,
}: {
  options: readonly Option<V>[]
  value: V
  onChange: (value: V) => void
  ariaLabel: string
  className?: string
}) {
  const refs = React.useRef<(HTMLButtonElement | null)[]>([])

  function onKeyDown(e: React.KeyboardEvent, index: number) {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return
    e.preventDefault()
    const next = (index + (e.key === "ArrowRight" ? 1 : -1) + options.length) % options.length
    const opt = options[next]
    if (!opt) return
    onChange(opt.value)
    refs.current[next]?.focus()
  }

  return (
    <div role="radiogroup" aria-label={ariaLabel} className={cn("inline-flex rounded-control bg-mist p-0.5", className)}>
      {options.map((o, i) => {
        const selected = o.value === value
        return (
          <button
            key={o.value}
            ref={(el) => { refs.current[i] = el }}
            type="button"
            role="radio"
            aria-checked={selected}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(o.value)}
            onKeyDown={(e) => onKeyDown(e, i)}
            className={cn(
              "focus-ring t-callout h-8 rounded-[8px] px-3.5 font-medium transition-colors duration-[160ms]",
              selected ? "bg-canvas text-ink" : "text-ink-2 hover:text-ink"
            )}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}
