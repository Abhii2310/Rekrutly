import Link from "next/link"
import { ChevronRight } from "lucide-react"
import { cn } from "cn"

/** Inset grouped list: white rows inside a mist container, hairlines inset 16px. */
export function GroupedList({ className, children, ...props }: React.ComponentProps<"ul">) {
  return (
    <div className={cn("rounded-group bg-mist p-1", className)}>
      <ul className="overflow-hidden rounded-[10px] bg-canvas" {...props}>{children}</ul>
    </div>
  )
}

type RowProps = {
  /** Left slot, for example an Avatar. */
  leading?: React.ReactNode
  title: React.ReactNode
  subtitle?: React.ReactNode
  /** Right side: a number, short text or a pill. */
  value?: React.ReactNode
  pill?: React.ReactNode
  /** Plain buttons on the right (for example Copy link). Not used together with href or onClick. */
  actions?: React.ReactNode
  href?: string
  onClick?: () => void
  className?: string
  /** Let long titles wrap instead of being cut off. For sentences, not names. */
  wrap?: boolean
}

const rowBase =
  "focus-ring flex min-h-14 w-full items-center gap-3 px-4 py-2 text-left"

export function ListRow({ leading, title, subtitle, value, pill, actions, href, onClick, className, wrap }: RowProps) {
  const interactive = Boolean(href || onClick)
  const body = (
    <>
      {leading ? <span className="shrink-0">{leading}</span> : null}
      <span className="min-w-0 flex-1">
        <span className={cn("t-headline block text-ink", !wrap && "truncate")}>{title}</span>
        {subtitle ? <span className={cn("t-callout block text-ink-2", !wrap && "truncate")}>{subtitle}</span> : null}
      </span>
      {value ? <span className="t-callout tabular shrink-0 text-ink-2">{value}</span> : null}
      {pill ? <span className="shrink-0">{pill}</span> : null}
      {actions ? <span className="flex shrink-0 items-center gap-3">{actions}</span> : null}
      {interactive ? <ChevronRight aria-hidden className="size-4 shrink-0 text-ink-3" strokeWidth={1.75} /> : null}
    </>
  )
  const cls = cn(rowBase, interactive && "transition-colors duration-[160ms] hover:bg-mist/60", className)
  return (
    <li className="relative list-none after:absolute after:bottom-0 after:left-4 after:right-0 after:h-px after:bg-hairline/70 last:after:hidden">
      {href ? (
        <Link href={href} className={cls}>{body}</Link>
      ) : onClick ? (
        <button type="button" onClick={onClick} className={cls}>{body}</button>
      ) : (
        <div className={cls}>{body}</div>
      )}
    </li>
  )
}
