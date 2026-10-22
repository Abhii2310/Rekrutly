import Link from "next/link"
import { Check } from "lucide-react"
import { cn } from "cn"
import { Button } from "@/components/ui/button"
import type { GuideProgress } from "@/lib/db/queries/guide"

type Step = { title: string; hint: string; done: boolean; href: string; cta: string }

/** The five things to do, in order, ticked from real data. The first undone step is the one to do next. */
export function GettingStarted({ progress }: { progress: GuideProgress }) {
  const steps: Step[] = [
    { title: "Add your candidates", hint: "Add people one by one, or import a CSV, on a role's page.", done: progress.candidates > 0, href: "/jobs", cta: "Open roles" },
    { title: "Ask Rekrutly to prepare an assessment", hint: "Type one sentence. It writes the questions and shows you a plan. Nothing is sent yet.", done: progress.assessments > 0, href: "/command", cta: "Tell Rekrutly" },
    { title: "Approve, and the links go out by email", hint: "Tick \"Record the candidate on camera\" for a proctored exam, then approve.", done: progress.invitations > 0, href: progress.latestRunId ? `/runs/${progress.latestRunId}` : "/command", cta: "Review the plan" },
    { title: "Candidates take the exam", hint: "Watch them start in the War Room, with a live camera picture if it is proctored.", done: progress.started > 0, href: "/war-room", cta: "Open the War Room" },
    { title: "Review the results", hint: "Scores with evidence, flagged moments and the recording. You decide; Rekrutly never picks a winner.", done: progress.submitted > 0, href: "/war-room", cta: "See results" },
  ]
  const doneCount = steps.filter((s) => s.done).length
  const next = steps.findIndex((s) => !s.done)

  return (
    <section aria-labelledby="start-title" className="rounded-group bg-mist p-5 sm:p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="start-title" className="t-title text-ink">{doneCount === steps.length ? "You're all set" : "Get started"}</h2>
        <span className="t-callout tabular text-ink-2">{doneCount} of {steps.length} done</span>
      </div>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-fog" role="img" aria-label={`${doneCount} of ${steps.length} steps done`}>
        <div className="h-full rounded-full bg-ink transition-[width] duration-500" style={{ width: `${(doneCount / steps.length) * 100}%` }} />
      </div>
      <ol className="mt-5 flex flex-col gap-4">
        {steps.map((s, i) => (
          <li key={s.title} className="flex items-start gap-3">
            <span
              aria-hidden
              className={cn("mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full text-[13px] font-medium", s.done ? "bg-success text-white" : i === next ? "bg-ink text-canvas" : "bg-fog text-ink-2")}
            >
              {s.done ? <Check className="size-3.5" strokeWidth={3} /> : i + 1}
            </span>
            <div className="min-w-0 flex-1">
              <p className={cn("t-body", s.done ? "text-ink-2 line-through decoration-ink-3" : "text-ink")}>{s.title}</p>
              {i === next ? <p className="t-callout mt-0.5 text-ink-2">{s.hint}</p> : null}
              {i === next ? <Button asChild size="sm" className="mt-2.5"><Link href={s.href}>{s.cta}</Link></Button> : null}
            </div>
          </li>
        ))}
      </ol>
      <p className="t-callout mt-5 text-ink-2">
        New here? <Link href="/guide" className="focus-ring rounded text-action hover:text-action-hover">Read the short guide</Link>.
      </p>
    </section>
  )
}
