import { cn } from "cn"
import { statusLabel, statusTone, type StatusKind, type StatusValue, type Tone } from "@/lib/status"

const TONE_CLASS: Record<Tone, string> = {
  neutral: "bg-neutral-tint text-neutral",
  action: "bg-action-tint text-action",
  success: "bg-success-tint text-success",
  warning: "bg-warning-tint text-warning",
  danger: "bg-danger-tint text-danger",
  ai: "bg-ai-tint text-ai",
}

export function Pill({ tone = "neutral", className, children }: { tone?: Tone; className?: string; children: React.ReactNode }) {
  return (
    <span className={cn("t-footnote inline-flex h-[22px] items-center whitespace-nowrap rounded-full px-2.5", TONE_CLASS[tone], className)}>
      {children}
    </span>
  )
}

/** Reads label and tone from lib/status.ts, so no status string is hard-coded in components. */
export function StatusPill<K extends StatusKind>({ kind, value, label }: { kind: K; value: StatusValue<K>; label?: string }) {
  return <Pill tone={statusTone(kind, value)}>{label ?? statusLabel(kind, value)}</Pill>
}
