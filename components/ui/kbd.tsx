import { cn } from "cn"

export function Kbd({ className, ...props }: React.ComponentProps<"kbd">) {
  return (
    <kbd
      className={cn("t-footnote inline-flex h-5 min-w-5 items-center justify-center rounded-md bg-mist px-1.5 font-sans text-ink-2", className)}
      {...props}
    />
  )
}
