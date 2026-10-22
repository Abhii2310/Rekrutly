import { JoinButton } from "@/components/hr/join-button"
import { PortalShell, StateMessage } from "@/components/portal/shell"
import { getDb } from "@/lib/db/server"
import { whenLabel } from "@/lib/interviews/rules"
import { hashToken } from "@/lib/security/tokens"

export const dynamic = "force-dynamic"
const SHAPE = /^[A-Za-z0-9_-]{43}$/

/** The candidate's page for their interview: when it is, and a join button that turns on 10 minutes before. No account needed. */
export default async function InterviewJoinPage({ params }: { params: Promise<{ token: string }> }) {
  const { token: raw } = await params
  const token = raw.trim().replace(/[^A-Za-z0-9_-]+$/, "")
  if (!SHAPE.test(token)) return <StateMessage title="This link isn't valid.">Open the newest email from the hiring team and tap the button in it.</StateMessage>
  const q = await getDb().from("interviews")
    .select("scheduled_at, duration_minutes, status, meeting_url, candidates(full_name), jobs(title)").eq("token_hash", hashToken(token)).maybeSingle()
  if (q.error || !q.data) return <StateMessage title="This link isn't valid.">Open the newest email from the hiring team and tap the button in it.</StateMessage>
  const iv = q.data as unknown as { scheduled_at: string; duration_minutes: number; status: string; meeting_url: string; candidates: { full_name: string } | null; jobs: { title: string } | null }
  if (iv.status === "cancelled") return <StateMessage title="This interview was cancelled.">The hiring team will email you if there is a new time.</StateMessage>
  const first = (iv.candidates?.full_name ?? "there").split(/\s+/)[0]
  return (
    <PortalShell>
      <h1 className="t-large text-ink">Hi {first}.</h1>
      <p className="t-body mt-2 text-ink-2">Your interview for the {iv.jobs?.title ?? "role"}</p>
      <dl className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div><dt className="t-callout text-ink-2">When</dt><dd className="t-headline mt-0.5 text-ink">{whenLabel(new Date(iv.scheduled_at))}</dd></div>
        <div><dt className="t-callout text-ink-2">How long</dt><dd className="t-headline mt-0.5 text-ink">About {iv.duration_minutes} minutes</dd></div>
      </dl>
      <div className="mt-8"><JoinButton scheduledAt={iv.scheduled_at} durationMinutes={iv.duration_minutes} meetingUrl={iv.meeting_url} /></div>
      <section className="mt-10 rounded-group bg-mist p-5">
        <h2 className="t-headline text-ink">Before the call</h2>
        <ul className="t-callout mt-3 flex flex-col gap-2 text-ink-2">
          <li>Use a quiet place and a stable connection. Headphones help.</li>
          <li>It is a conversation about your experience and your assessment.</li>
          <li>If the time does not work, reply to the email from the hiring team.</li>
        </ul>
      </section>
    </PortalShell>
  )
}
