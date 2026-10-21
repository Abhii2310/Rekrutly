import { cn } from "cn"

/** Big number above a callout label. No box, no icon. */
export function Stat({ value, label, className }: { value: React.ReactNode; label: string; className?: string }) {
  return (
    <div className={cn("min-w-0", className)}>
      <div className="t-stat text-ink">{value}</div>
      <div className="t-callout mt-1 text-ink-2">{label}</div>
    </div>
  )
}
