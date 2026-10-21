"use client"

import * as React from "react"
import { cn } from "cn"
import { fieldClass } from "@/components/ui/input"

/** Auto-growing textarea: starts at 44px and grows with its content. */
function Textarea({ className, onChange, ...props }: React.ComponentProps<"textarea">) {
  const ref = React.useRef<HTMLTextAreaElement>(null)

  const resize = React.useCallback(() => {
    const el = ref.current
    if (!el) return
    el.style.height = "auto"
    el.style.height = `${el.scrollHeight}px`
  }, [])

  React.useLayoutEffect(resize, [resize, props.value])

  return (
    <textarea
      ref={ref}
      rows={1}
      data-slot="textarea"
      className={cn(fieldClass, "min-h-11 resize-none overflow-hidden py-[10px]", className)}
      onChange={(e) => {
        resize()
        onChange?.(e)
      }}
      {...props}
    />
  )
}

export { Textarea }
