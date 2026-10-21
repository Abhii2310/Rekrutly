import { cn } from "cn"

/** A titled block. Sections are separated by 48px. */
export function Section({ title, action, className, children }: { title: string; action?: React.ReactNode; className?: string; children: React.ReactNode }) {
  return (
    <section className={cn("mt-12 first:mt-0", className)}>
      <div className="mb-4 flex items-end justify-between gap-4">
        <h2 className="t-title text-ink">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  )
}
