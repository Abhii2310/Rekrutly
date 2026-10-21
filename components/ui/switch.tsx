"use client"

import * as React from "react"
import { cn } from "cn"
import { Switch as SwitchPrimitive } from "radix-ui"

function Switch({ className, ...props }: React.ComponentProps<typeof SwitchPrimitive.Root>) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      className={cn("focus-ring inline-flex h-[26px] w-[44px] shrink-0 items-center rounded-full bg-fog p-0.5 transition-colors duration-[160ms] data-[state=checked]:bg-action disabled:opacity-50", className)}
      {...props}
    >
      <SwitchPrimitive.Thumb className="block size-[22px] rounded-full bg-white transition-transform duration-[160ms] ease-[var(--ease-spring)] data-[state=checked]:translate-x-[18px]" />
    </SwitchPrimitive.Root>
  )
}

export { Switch }
