"use client"

import * as React from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { ChevronDown } from "lucide-react"
import { Button } from "@/components/ui/button"
import { GroupedList, ListRow } from "@/components/ui/grouped-list"
import { Input } from "@/components/ui/input"
import { Pill, StatusPill } from "@/components/ui/status-pill"
import { DemoTag } from "@/components/ui/tags"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { toast } from "@/components/ui/toaster"
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
          <div className="t-callout flex flex-col gap-0.5 text-ink-2">
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
          </Block>

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
        </div>
      </SheetContent>
    </Sheet>
  )
}
