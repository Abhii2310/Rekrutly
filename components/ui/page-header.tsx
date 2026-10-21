"use client"

import * as React from "react"
import { cn } from "cn"

/** Content column: max 1120px, 40px side padding (24px under 1024px, 16px on phones). */
export function PageBody({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("mx-auto w-full max-w-[1120px] px-4 pb-16 pt-6 md:px-6 lg:px-10", className)} {...props} />
}

/** Large title, one-line callout, actions on the same baseline. Sticky with a blur and a hairline that appears after 8px of scroll. */
export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: React.ReactNode }) {
  const [scrolled, setScrolled] = React.useState(false)

  React.useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8)
    onScroll()
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => window.removeEventListener("scroll", onScroll)
  }, [])

  return (
    <header
      data-print-hide
      className={cn(
        "sticky top-0 z-20 border-b transition-colors duration-[160ms]",
        scrolled ? "border-hairline bg-white/70 backdrop-blur-[20px] backdrop-saturate-[180%]" : "border-transparent bg-canvas"
      )}
    >
      <div className="mx-auto flex w-full max-w-[1120px] flex-wrap items-end justify-between gap-x-6 gap-y-3 px-4 pb-4 pt-10 md:px-6 lg:px-10">
        <div className="min-w-0">
          <h1 className="t-large truncate text-ink">{title}</h1>
          {description ? <p className="t-callout mt-1 text-ink-2">{description}</p> : null}
        </div>
        {actions ? <div className="flex shrink-0 flex-wrap items-center gap-3 pb-1">{actions}</div> : null}
      </div>
    </header>
  )
}
