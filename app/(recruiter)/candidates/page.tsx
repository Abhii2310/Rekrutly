import { QueryError } from "@/components/frame/query-error"
import { CandidateFilters } from "@/components/candidates/filters"
import { CandidateSheet, type ProfileData } from "@/components/candidates/profile-sheet"
import { EmptyState } from "@/components/ui/empty-state"
import { SelectableCandidates } from "@/components/candidates/selectable-list"
import { PageBody, PageHeader } from "@/components/ui/page-header"
import { DemoTag } from "@/components/ui/tags"
import { groupStages, parseGroup } from "@/lib/candidate-groups"
import { getHrData, listHrBadges } from "@/lib/hr/queries"
import { getCandidate, listCandidates } from "@/lib/db/queries/candidates"
import { listJobs } from "@/lib/db/queries/jobs"
import { formatRelative } from "@/lib/format"
import { plural } from "@/lib/format-text"
import { allowedTransitions } from "@/lib/status"

export const dynamic = "force-dynamic"

type SearchParams = { g?: string; job?: string; q?: string; c?: string }
const UUID = /^[0-9a-f-]{36}$/i

export default async function CandidatesPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams
  const group = parseGroup(sp.g)
  const jobId = sp.job && UUID.test(sp.job) ? sp.job : ""
  const search = (sp.q ?? "").slice(0, 100)
  const selected = sp.c && UUID.test(sp.c) ? sp.c : null

  const [list, jobs, detail] = await Promise.all([
    listCandidates({ jobId: jobId || undefined, stage: groupStages(group), search }),
    listJobs(),
    selected ? getCandidate(selected) : Promise.resolve(null),
  ])

  if (!list.ok || !jobs.ok) {
    return (
      <>
        <PageHeader title="Candidates" />
        <PageBody><QueryError message="Couldn't load candidates." /></PageBody>
      </>
    )
  }

  const now = new Date()
  const badges = await listHrBadges(list.data.map((c) => c.id))
  const hr = detail?.ok && detail.data ? await getHrData(detail.data.id) : null
  let profile: ProfileData | null = null
  if (detail?.ok && detail.data) {
    const c = detail.data
    profile = {
      id: c.id,
      fullName: c.full_name,
      role: c.current_title && c.current_company ? `${c.current_title} at ${c.current_company}` : c.current_title,
      location: c.location,
      yearsExperience: c.years_experience,
      skills: c.skills,
      resumeSummary: c.resume_summary,
      email: c.email,
      phone: c.phone,
      stage: c.stage,
      isDemo: c.is_demo,
      jobTitle: c.job_title,
      nextStages: [...allowedTransitions("candidate", c.stage)],
      events: c.events.map((e) => ({ id: e.id, message: e.message, when: formatRelative(e.created_at, now) })),
      assessments: c.assessments,
      hr: hr?.ok ? hr.data : null,
    }
  }

  return (
    <>
      <PageHeader title="Candidates" description={plural(list.data.length, "candidate")} actions={list.data.some((c) => c.is_demo) ? <DemoTag /> : undefined} />
      <PageBody>
        <CandidateFilters group={group} jobId={jobId} search={search} jobs={jobs.data.map((j) => ({ id: j.id, title: j.title }))} />
        {detail && !detail.ok ? <QueryError message="Couldn't load that candidate." /> : null}
        {list.data.length === 0 ? (
          <div className="rounded-group bg-mist">
            <EmptyState message={search || jobId || group !== "all" ? "No candidates match these filters." : "No candidates yet."} />
          </div>
        ) : (
          <SelectableCandidates
            rows={list.data.map((c) => ({
              id: c.id, jobId: c.job_id, jobTitle: c.job_title, name: c.full_name, stage: c.stage,
              match: badges.get(c.id)?.score ?? null, shortlisted: badges.get(c.id)?.shortlisted ?? false, interview: badges.get(c.id)?.interview ?? false, offer: badges.get(c.id)?.offer ?? false,
              subtitle: c.current_title && c.current_company ? `${c.current_title} at ${c.current_company}` : c.current_title,
              href: `/candidates?${new URLSearchParams({ ...(sp.g ? { g: sp.g } : {}), ...(jobId ? { job: jobId } : {}), ...(search ? { q: search } : {}), c: c.id }).toString()}`,
            }))}
          />
        )}
        {profile ? <CandidateSheet key={profile.id} candidate={profile} /> : null}
      </PageBody>
    </>
  )
}
