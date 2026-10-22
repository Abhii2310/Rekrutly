import Link from "next/link"
import { notFound } from "next/navigation"
import { InterviewWorkspace } from "@/components/hr/interview-workspace"
import { QueryError } from "@/components/frame/query-error"
import { Button } from "@/components/ui/button"
import { PageBody, PageHeader } from "@/components/ui/page-header"
import { Pill, StatusPill } from "@/components/ui/status-pill"
import { getDb } from "@/lib/db/server"
import { getDossier } from "@/lib/hr/dossier"
import type { Scorecard } from "@/lib/hr/types"
import { whenLabel } from "@/lib/interviews/rules"
import { decryptToken } from "@/lib/security/tokens"
import { env } from "@/lib/env"
import { CopyLinkButton } from "@/components/hr/copy-link"

export const dynamic = "force-dynamic"

export default async function InterviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound()
  const q = await getDb().from("interviews").select("id, candidate_id, scheduled_at, duration_minutes, status, notes, scorecard, meeting_url, token_encrypted, email_status").eq("id", id).maybeSingle()
  if (q.error) return <><PageHeader title="Interview" /><PageBody><QueryError message="Couldn't load this interview." /></PageBody></>
  if (!q.data) notFound()
  const iv = q.data as unknown as { candidate_id: string; scheduled_at: string; duration_minutes: number; status: "scheduled" | "completed" | "cancelled"; notes: string; scorecard: Scorecard | null; meeting_url: string; token_encrypted: string; email_status: string }
  const dossier = await getDossier(iv.candidate_id)
  if (!dossier.ok || !dossier.data) return <><PageHeader title="Interview" /><PageBody><QueryError message="Couldn't load the candidate." /></PageBody></>
  const d = dossier.data
  const joinUrl = `${env.APP_URL}/i/${decryptToken(iv.token_encrypted)}`

  return (
    <>
      <PageHeader
        title={d.name}
        description={`${d.jobTitle ?? "Interview"}. ${whenLabel(new Date(iv.scheduled_at))}, ${iv.duration_minutes} minutes.`}
        actions={<><Button asChild variant="secondary" size="sm"><Link href={`/candidates/${d.id}/portfolio`}>Full portfolio</Link></Button><Button asChild size="sm"><a href={iv.meeting_url} target="_blank" rel="noreferrer">Open the video call</a></Button></>}
      />
      <PageBody>
        <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_320px]">
          <InterviewWorkspace id={id} status={iv.status} initialNotes={iv.notes} initialScorecard={iv.scorecard} />
          <aside aria-label="About the candidate" className="flex flex-col gap-6">
            <section className="rounded-group bg-mist p-5">
              <h2 className="t-headline text-ink">At a glance</h2>
              <div className="mt-3 flex flex-wrap items-center gap-2"><StatusPill kind="candidate" value={d.stage} />{d.shortlisted ? <Pill>Shortlisted</Pill> : null}</div>
              <dl className="t-callout mt-4 flex flex-col gap-3 text-ink-2">
                {d.match ? <div><dt>Resume match (suggested by AI)</dt><dd className="t-headline text-ink">{d.match.score}%</dd></div> : null}
                {d.assessments.map((a) => <div key={a.submissionId}><dt>{a.title}</dt><dd className="t-headline text-ink">{a.finalPct !== null ? `${a.finalPct}%` : "Scoring"}</dd></div>)}
                {d.proctoring ? <div><dt>Camera exam</dt><dd className="text-ink">{d.proctoring.flagged === 0 ? "Nothing flagged" : `${d.proctoring.flagged} ${d.proctoring.flagged === 1 ? "moment" : "moments"} to review`}</dd></div> : null}
              </dl>
              {d.assessments[0]?.skills.length ? (
                <ul className="mt-4 flex flex-col gap-2">{d.assessments[0].skills.map((s) => <li key={s.skill} className="t-callout flex justify-between text-ink-2"><span>{s.skill}</span><span className="tabular text-ink">{s.percent}%</span></li>)}</ul>
              ) : null}
              {d.assessments[0]?.gaps.length ? <p className="t-callout mt-4 text-ink-2">Worth probing: {d.assessments[0].gaps.join(", ")}.</p> : null}
            </section>
            <section className="rounded-group bg-mist p-5">
              <h2 className="t-headline text-ink">Candidate link</h2>
              <p className="t-callout mt-1 text-ink-2">{iv.email_status === "sent" ? "Emailed to them." : "Not emailed. Copy this and send it yourself."}</p>
              <div className="mt-3"><CopyLinkButton url={joinUrl} /></div>
            </section>
          </aside>
        </div>
      </PageBody>
    </>
  )
}
