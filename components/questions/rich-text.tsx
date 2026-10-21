import { cn } from "cn"

/**
 * Renders model or recruiter text as plain text, with ``` fenced blocks shown in a mono font on mist.
 * Nothing here is ever interpreted as HTML.
 */
export function RichText({ text, className }: { text: string; className?: string }) {
  const parts = text.split(/```(?:[a-zA-Z0-9+#-]*)?\n?([\s\S]*?)```/g)
  return (
    <div className={cn("t-body flex flex-col gap-3 text-ink", className)}>
      {parts.map((part, i) =>
        i % 2 === 1 ? (
          <pre key={i} className="overflow-x-auto rounded-control bg-mist px-4 py-3 font-mono text-[13px] leading-5 text-ink">
            <code>{part.replace(/\n$/, "")}</code>
          </pre>
        ) : part.trim() ? (
          <p key={i} className="whitespace-pre-wrap">{part.trim()}</p>
        ) : null
      )}
    </div>
  )
}

/** First line of a prompt, without code fences, for a collapsed row. */
export function firstLine(text: string): string {
  const plain = text.replace(/```[\s\S]*?```/g, " ").replace(/\s+/g, " ").trim()
  return plain || text.replace(/\s+/g, " ").trim()
}
