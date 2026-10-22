"use client"

import * as React from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { ChevronDown } from "lucide-react"
import { Button } from "@/components/ui/button"
import { GroupedList, ListRow } from "@/components/ui/grouped-list"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Pill, StatusPill } from "@/components/ui/status-pill"
import { DemoTag } from "@/components/ui/tags"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { toast } from "@/components/ui/toaster"
import { AiInterviewPanel } from "@/components/hr/ai-interview-panel"
import { InterviewPanel } from "@/components/hr/interview-panel"
import { OfferPanel } from "@/components/hr/offer-panel"
import { RejectDialog } from "@/components/hr/reject-dialog"
import { ResumePanel } from "@/components/hr/resume-panel"
import type { HrData } from "@/lib/hr/types"
import { cn } from "cn"
import { statusLabel, type Stage } from "@/lib/status"

export type ProfileData = {
  id: string
  fullName: string
  role: string | null
  location: string | null
  yearsExperience: number | null
  skills: string[]
  resumeSummary: string
  email: string | null
  phone: string | null
  stage: Stage
  isDemo: boolean
  jobTitle: string | null
  nextStages: Stage[]
  events: { id: number; message: string; when: string }[]
  assessments: { invitationId: string; title: string; status: string; submissionId: string | null; finalPct: number | null; scored: boolean }[]
  /** Null when the hiring-flow tables are not available yet. */
  hr: HrData | null
}

async function patch(id: string, body: { email?: string | null; stage?: Stage }): Promise<string | null> {
  const res = await fetch(`/api/candidates/${id}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  })
  if (res.ok) return null
  const json = (await res.json().catch(() => null)) as { error?: { message?: string } } | null
  return json?.error?.message ?? "Couldn't save the change."
}

type Tab = "overview" | "resume" | "assessment" | "interview" | "offer" | "activity"

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <h3 className="t-headline mb-3 text-ink">{title}</h3>
      {children}
    </section>
  )
}

/** Opens from `?c=<id>`, so a profile is linkable and survives a refresh. */
export function CandidateSheet({ candidate }: { candidate: ProfileData }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [email, setEmail] = React.useState("")
  const [pending, setPending] = React.useState<"email" | "stage" | null>(null)
  const [emailError, setEmailError] = React.useState<string | null>(null)
  const [tab, setTab] = React.useState<Tab>("overview")
  const [deleteOpen, setDeleteOpen] = React.useState(false)
  const [deleting, setDeleting] = React.useState(false)

  function close() {
    const p = new URLSearchParams(searchParams.toString())
    p.delete("c")
    const qs = p.toString()
    router.replace(qs ? `${pathname}?${qs}` : pathname)
  }

  async function addEmail(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim() || pending) return
    setPending("email")
    setEmailError(null)
    const error = await patch(candidate.id, { email: email.trim() })
    setPending(null)
    if (error) return setEmailError(error)
    setEmail("")
    toast("Email added")
    router.refresh()
  }

  async function deleteData() {
    setDeleting(true)
    try {
      const res = await fetch(`/api/candidates/${candidate.id}`, { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ confirm: true }) })
      if (res.ok) {
        toast("Candidate deleted")
        setDeleteOpen(false)
        close()
        router.refresh()
        return
      }
      const body = (await res.json().catch(() => null)) as { error?: { message?: string } } | null
      toast(body?.error?.message ?? "Couldn't delete. Nothing was removed.")
    } catch {
      toast("Couldn't reach the server. Nothing was removed.")
    }
    setDeleting(false)
  }

  async function changeStage(stage: Stage) {
    setPending("stage")
    const error = await patch(candidate.id, { stage })
    setPending(null)
    if (error) return toast(error)
    toast(`Moved to ${statusLabel("candidate", stage)}`)
    router.refresh()
  }

  return (
    <Sheet open onOpenChange={(open) => { if (!open) close() }}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>{candidate.fullName}</SheetTitle>
          <SheetDescription>{candidate.role ?? candidate.jobTitle ?? ""}</SheetDescription>
        </SheetHeader>

        <div className="px-8 pb-10">
          <div role="tablist" aria-label="Candidate sections" className="-mx-1 mb-2 flex gap-1 overflow-x-auto pb-1">
            {([["overview", "Overview"], ...(candidate.hr ? [["resume", "Resume"]] : []), ["assessment", "Assessment"], ...(candidate.hr ? [["interview", "Interview"], ["offer", "Offer"]] : []), ["activity", "Activity"]] as [Tab, string][]).map(([key, label]) => (
              <button
                key={key} type="button" role="tab" aria-selected={tab === key} onClick={() => setTab(key)}
                className={cn("focus-ring t-callout shrink-0 rounded-full px-3.5 py-1.5 transition-colors", tab === key ? "bg-ink text-canvas" : "text-ink-2 hover:bg-fog")}
              >{label}</button>
            ))}
          </div>
          {tab === "overview" ? (<>
          <div className="t-callout mt-4 flex flex-col gap-0.5 text-ink-2">
            {candidate.location ? <span>{candidate.location}</span> : null}
            {candidate.yearsExperience !== null ? <span>{candidate.yearsExperience} years of experience</span> : null}
            {candidate.jobTitle ? <span>Applying for {candidate.jobTitle}</span> : null}
          </div>
          {candidate.isDemo ? <div className="mt-3"><DemoTag /></div> : null}

          {candidate.skills.length ? (
            <div className="mt-5 flex flex-wrap gap-2">
              {candidate.skills.map((s) => <Pill key={s}>{s}</Pill>)}
            </div>
          ) : null}

          {candidate.resumeSummary ? <p className="t-body mt-5 text-ink">{candidate.resumeSummary}</p> : null}

          <Block title="Contact">
            {candidate.email ? (
              <p className="t-body text-ink">{candidate.email}</p>
            ) : (
              <form onSubmit={addEmail} className="flex flex-col gap-3">
                <p className="t-callout text-ink-2">No email. Candidates can still use a link.</p>
                <div className="flex items-start gap-3">
                  <div className="flex-1">
                    <Input
                      type="email"
                      aria-label="Email address"
                      placeholder="name@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      aria-invalid={emailError ? true : undefined}
                    />
                    {emailError ? <p role="alert" className="t-callout mt-2 text-danger">{emailError}</p> : null}
                  </div>
                  <Button type="submit" variant="secondary" loading={pending === "email"} disabled={!email.trim()} className="h-11">
                    Add email
                  </Button>
                </div>
              </form>
            )}
            {candidate.phone ? <p className="t-callout mt-3 text-ink-2">WhatsApp {candidate.phone}</p> : null}
          </Block>

          <Block title="Stage">
            <div className="flex items-center gap-3">
              <StatusPill kind="candidate" value={candidate.stage} />
              {candidate.nextStages.length ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="plain" size="sm" disabled={pending === "stage"}>
                      Change stage
                      <ChevronDown aria-hidden className="ml-1 size-3.5" strokeWidth={1.75} />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                    {candidate.nextStages.map((s) => (
                      <DropdownMenuItem key={s} onSelect={() => changeStage(s)}>{statusLabel("candidate", s)}</DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : (
                <span className="t-callout text-ink-2">No further stages.</span>
              )}
            </div>
            {["rejected", "withdrawn", "hired"].includes(candidate.stage) ? null : (
              <div className="mt-4">
                <RejectDialog candidateId={candidate.id} firstName={candidate.fullName.split(/\s+/)[0] ?? candidate.fullName} name={candidate.fullName} role={candidate.jobTitle ?? "open"} email={candidate.email} />
              </div>
            )}
          </Block>
          {candidate.hr ? (
            <div className="mt-8"><Button asChild variant="secondary" size="sm"><a href={`/candidates/${candidate.id}/portfolio`}>Open the full portfolio</a></Button></div>
          ) : null}

          <Block title="Data and privacy">
            <p className="t-callout text-ink-2">If this person asks for a copy of their data, or asks you to delete it, you can do both here.</p>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <Button asChild variant="secondary" size="sm"><a href={`/api/candidates/${candidate.id}/export`} download>Export data</a></Button>
              <Button variant="destructive" size="sm" onClick={() => setDeleteOpen(true)}>Delete data</Button>
            </div>
          </Block>
          </>) : null}

          {tab === "resume" && candidate.hr ? (
            <Block title="Resume match">
              <ResumePanel candidateId={candidate.id} roleTitle={candidate.jobTitle} hr={candidate.hr} />
            </Block>
          ) : null}

          {tab === "assessment" ? (
          <Block title="Assessments">
            {candidate.assessments.length === 0 ? (
              <p className="t-body text-ink-2">No assessments yet.</p>
            ) : (
              <GroupedList>
                {candidate.assessments.map((a) => (
                  <ListRow
                    key={a.invitationId}
                    title={<span className="t-body font-medium">{a.title}</span>}
                    subtitle={a.submissionId ? (a.scored ? "Scored" : "Submitted, scoring") : a.status === "started" ? "In progress" : "Not started"}
                    value={a.finalPct !== null ? `${a.finalPct}%` : undefined}
                    href={a.submissionId ? `/submissions/${a.submissionId}` : undefined}
                  />
                ))}
              </GroupedList>
            )}
          </Block>
          ) : null}

          {tab === "interview" && candidate.hr ? (
            <Block title="AI interview">
              <AiInterviewPanel ai={candidate.hr.aiInterview} />
            </Block>
          ) : null}

          {tab === "interview" && candidate.hr ? (
            <Block title="Live interview">
              <InterviewPanel candidateId={candidate.id} candidateName={candidate.fullName} email={candidate.email} interviews={candidate.hr.interviews} />
            </Block>
          ) : null}

          {tab === "offer" && candidate.hr ? (
            <Block title="Offer letter">
              <OfferPanel candidateId={candidate.id} candidateName={candidate.fullName} email={candidate.email} offers={candidate.hr.offers} />
            </Block>
          ) : null}

          {tab === "activity" ? (
          <Block title="Activity">
            {candidate.events.length === 0 ? (
              <p className="t-body text-ink-2">No activity yet.</p>
            ) : (
              <GroupedList>
                {candidate.events.map((e) => (
                  <ListRow key={e.id} title={<span className="t-body font-normal">{e.message}</span>} value={e.when} />
                ))}
              </GroupedList>
            )}
          </Block>
          ) : null}
        </div>
      </SheetContent>
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete {candidate.fullName}&apos;s data?</DialogTitle>
            <DialogDescription>
              This permanently deletes the profile, candidate links, answers, scores, reports, tasks and the activity about this person. It cannot be undone. A receipt without their name is kept to show that a deletion happened. Export their data first if they asked for a copy.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setDeleteOpen(false)}>Keep</Button>
            <Button variant="destructive" loading={deleting} onClick={() => void deleteData()}>Delete data</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Sheet>
  )
}
