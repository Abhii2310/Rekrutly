"use client"

import { Toaster as Sonner } from "sonner"

export { toast } from "sonner"

/** White, sheet radius, one soft shadow, 13px text. */
export function Toaster() {
  return (
    <Sonner
      position="bottom-center"
      toastOptions={{
        unstyled: true,
        classNames: {
          toast:
            "t-callout flex w-[356px] max-w-[calc(100vw-32px)] items-center gap-3 rounded-sheet bg-canvas px-4 py-3 text-ink shadow-[0_8px_30px_rgb(0_0_0/0.12)]",
          title: "font-medium",
          description: "text-ink-2",
        },
      }}
    />
  )
}
