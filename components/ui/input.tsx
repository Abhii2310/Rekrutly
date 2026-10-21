import * as React from "react"
import { cn } from "cn"

export const fieldClass =
  "focus-ring w-full rounded-control border border-transparent bg-mist px-3.5 text-[15px] leading-[22px] text-ink outline-none transition-colors duration-[160ms] placeholder:text-ink-3 hover:bg-fog focus:border-action focus:bg-canvas disabled:opacity-50"

function Input({ className, type = "text", ...props }: React.ComponentProps<"input">) {
  return <input type={type} data-slot="input" className={cn(fieldClass, "h-11", className)} {...props} />
}

export { Input }
