import { cn } from "cn"

/** Soft, slowly drifting colour behind a section. Decorative only, so it is hidden from assistive tech. */
export function Aurora({ className, dark = false }: { className?: string; dark?: boolean }) {
  return (
    <div aria-hidden className={cn("pointer-events-none absolute inset-0 overflow-hidden", className)}>
      <div className={cn("aurora-a absolute -left-24 -top-28 size-[520px] rounded-full blur-[100px]", dark ? "bg-[#0071E3]/35" : "bg-[#0071E3]/25")} />
      <div className={cn("aurora-b absolute -right-24 top-6 size-[480px] rounded-full blur-[100px]", dark ? "bg-[#5E5CE6]/35" : "bg-[#5E5CE6]/25")} />
      <div className={cn("aurora-c absolute left-[32%] top-44 size-[400px] rounded-full blur-[100px]", dark ? "bg-[#64D2FF]/25" : "bg-[#64D2FF]/30")} />
    </div>
  )
}
