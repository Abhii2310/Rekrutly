import { AiCheck } from "@/components/settings/ai-check"
import { Button } from "@/components/ui/button"
import { GroupedList, ListRow } from "@/components/ui/grouped-list"
import { Kbd } from "@/components/ui/kbd"
import { PageBody, PageHeader } from "@/components/ui/page-header"
import { Pill } from "@/components/ui/status-pill"
import { Section } from "@/components/ui/section"
import { pingDb } from "@/lib/db/queries/system"
import { emailStatus, env } from "@/lib/env"

export const dynamic = "force-dynamic"

const EMAIL = {
  configured: { label: "Ready", tone: "success", note: "Invitations are sent by email." },
  not_configured: { label: "Not set up", tone: "neutral", note: "Links are shared by hand. Add RESEND_API_KEY to send email." },
  test_sender_without_recipient: { label: "Test sender", tone: "warning", note: "The test sender only reaches one address. Add DEMO_CANDIDATE_EMAIL or verify a domain." },
} as const

export default async function SettingsPage() {
  const db = await pingDb()
  const email = EMAIL[emailStatus(env)]

  return (
    <>
      <PageHeader title="Settings" description="Status, checks and shortcuts. Secrets are never shown here." />
      <PageBody>
        <div className="max-w-[720px]">
          <Section title="System" className="mt-0">
            <GroupedList>
              <ListRow title="Database" subtitle={db.ok ? `Answered in ${db.ms} ms` : "The database didn't answer."} pill={<Pill tone={db.ok ? "success" : "danger"}>{db.ok ? "Connected" : "Not reachable"}</Pill>} />
              <ListRow title="AI" subtitle={`${env.AI_PROVIDER}${env.AI_FALLBACK_PROVIDER ? `, backup ${env.AI_FALLBACK_PROVIDER}` : ", no backup provider"}`} pill={<Pill tone="success">Configured</Pill>} />
              <ListRow title="Email" subtitle={email.note} pill={<Pill tone={email.tone}>{email.label}</Pill>} />
              <ListRow title="Follow-up nudges" subtitle="A candidate who has not started gets a nudge task after" value={`${env.TASK_OVERDUE_MINUTES} min`} />
              <ListRow title="Demo mode" subtitle={env.DEMO_MODE ? "The Demo Director and saved fallbacks are available." : "Off. Demo tools are hidden."} pill={<Pill>{env.DEMO_MODE ? "On" : "Off"}</Pill>} />
              <ListRow title="App address" subtitle={env.APP_URL} />
            </GroupedList>
          </Section>

          <Section title="AI check">
            <AiCheck />
          </Section>

          <Section title="Records">
            <p className="t-body mb-3 text-ink-2">Every action leaves a receipt. Download them all as a spreadsheet for an audit.</p>
            <div className="flex flex-wrap items-center gap-3">
              <Button asChild variant="secondary"><a href="/api/activity/export?group=all" download>Export all activity</a></Button>
              <Button asChild variant="plain"><a href="/activity">Open Activity</a></Button>
            </div>
          </Section>

          <Section title="Shortcuts">
            <GroupedList>
              <ListRow title="Ask Rekrutly or jump anywhere" value={<span className="flex items-center gap-1"><Kbd>Ctrl</Kbd><Kbd>K</Kbd></span>} />
              <ListRow title="Plan an instruction" subtitle="In the Command Centre" value={<Kbd>Enter</Kbd>} />
              <ListRow title="Close a panel or dialog" value={<Kbd>Esc</Kbd>} />
              <ListRow title="Answer, as a candidate" subtitle="Pick option 1 to 4 on the keyboard" value={<span className="flex items-center gap-1"><Kbd>1</Kbd><Kbd>4</Kbd></span>} />
            </GroupedList>
          </Section>
        </div>
      </PageBody>
    </>
  )
}
