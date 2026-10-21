import 'server-only';
import { notFound } from "next/navigation"
import { Interactive } from "@/components/styleguide/interactive"
import { AIMark } from "@/components/ui/ai-mark"
import { Avatar } from "@/components/ui/avatar"
import { EmptyState } from "@/components/ui/empty-state"
import { GroupedList, ListRow } from "@/components/ui/grouped-list"
import { PageBody, PageHeader } from "@/components/ui/page-header"
import { ProgressRail, type RailStep } from "@/components/ui/progress-rail"
import { Skeleton } from "@/components/ui/skeleton"
import { Stat } from "@/components/ui/stat"
import { StatusPill } from "@/components/ui/status-pill"
import { DemoTag, SimulatedTag } from "@/components/ui/tags"
import { env } from "@/lib/env"
import { statusValues, type StatusKind } from "@/lib/status"

const KINDS: StatusKind[] = ["job", "candidate", "run", "step", "assessment", "invitation", "delivery", "scoring", "report", "task"]

const RAIL: RailStep[] = [
  { id: "1", title: "Write 10 questions", status: "completed", detail: "Wrote 10 questions across 4 skills", timestamp: "2:41 pm" },
  { id: "2", title: "Create assessment", status: "executing", detail: "Saving the assessment" },
  { id: "3", title: "Create 5 candidate links", status: "awaiting_approval" },
  { id: "4", title: "Send invitations", status: "skipped", detail: "Skipped: email not configured" },
  { id: "5", title: "Track submissions", status: "waiting", detail: "Waiting for 3 of 5 candidates" },
  { id: "6", title: "Score and prepare reports", status: "planned", detail: "Starts when submissions arrive" },
  { id: "7", title: "Prepare follow-ups", status: "failed", detail: "The AI took too long." },
]

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="t-title mb-4 text-ink">{title}</h2>
      {children}
    </section>
  )
}

export default function StyleguidePage() {
  if (!env.DEMO_MODE) notFound()
  return (
    <>
      <PageHeader title="Styleguide" description="Every primitive in every state." />
      <PageBody className="flex flex-col gap-12">
        <Section title="Type">
          <div className="flex flex-col gap-2">
            <p className="t-hero text-ink">Hero 44</p>
            <p className="t-large text-ink">Large title 32</p>
            <p className="t-title text-ink">Title 22</p>
            <p className="t-headline text-ink">Headline 17</p>
            <p className="t-body text-ink">Body 15. Rekrutly turns one instruction into a visible plan.</p>
            <p className="t-callout text-ink-2">Callout 13</p>
            <p className="t-footnote text-ink-2">Footnote 12</p>
          </div>
        </Section>

        <Section title="Stats">
          <div className="flex gap-12">
            <Stat value="15" label="Candidates" />
            <Stat value="4" label="In assessment" />
            <Stat value="68%" label="Completion rate" />
            <Stat value="3" label="Need you" />
          </div>
        </Section>

        <Section title="Status pills">
          <div className="flex flex-col gap-3">
            {KINDS.map((kind) => (
              <div key={kind} className="flex flex-wrap items-center gap-2">
                <span className="t-callout w-24 text-ink-2">{kind}</span>
                {(statusValues(kind) as readonly string[]).map((v) => (
                  <StatusPill key={v} kind={kind} value={v as never} />
                ))}
              </div>
            ))}
            <div className="flex items-center gap-3"><DemoTag /><SimulatedTag /><AIMark /></div>
          </div>
        </Section>

        <Section title="Grouped list">
          <GroupedList>
            <ListRow title="Review Diya's submission" subtitle="Backend Engineer at Kestrel Logistics" pill={<StatusPill kind="task" value="open" />} href="#" />
            <ListRow title="Rohan has no email" subtitle="Share his link or add an email" pill={<StatusPill kind="task" value="open" />} href="#" />
            <ListRow title="Full-Stack Developer" subtitle="Engineering, Bengaluru (hybrid)" value="5 candidates" href="#" />
            <ListRow title="Not clickable row" subtitle="No chevron" value="12:31" />
          </GroupedList>
          <div className="mt-4 flex items-center gap-3"><Avatar name="Aarav Mehta" /><Avatar name="Diya Raghunathan" /><Avatar name="Kabir" /></div>
        </Section>

        <Section title="Progress rail">
          <div className="max-w-[480px]"><ProgressRail steps={RAIL} /></div>
        </Section>

        <Section title="Loading and empty">
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Skeleton className="h-14 w-full" /><Skeleton className="h-14 w-full" /><Skeleton className="h-14 w-2/3" />
            </div>
            <div className="rounded-group bg-mist"><EmptyState message="No assessments yet. Ask Rekrutly to create one." action={{ label: "New task", href: "/command" }} /></div>
          </div>
        </Section>

        <Interactive />
      </PageBody>
    </>
  )
}
