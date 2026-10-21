import { Sparkles } from "lucide-react"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"

/** Every AI-written item shows this. Hover or focus explains what it means. */
export function AIMark({ label = "Suggested by AI" }: { label?: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button type="button" className="focus-ring t-footnote inline-flex items-center gap-1 rounded-full text-ai">
          <Sparkles aria-hidden className="size-3" strokeWidth={1.75} />
          {label}
        </button>
      </TooltipTrigger>
      <TooltipContent>Written by Rekrutly&apos;s AI. Review before you rely on it.</TooltipContent>
    </Tooltip>
  )
}
