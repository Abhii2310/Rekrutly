import { QueryError } from "@/components/frame/query-error"
import { CandidateFilters } from "@/components/candidates/filters"
import { CandidateSheet, type ProfileData } from "@/components/candidates/profile-sheet"
import { Avatar } from "@/components/ui/avatar"
import { EmptyState } from "@/components/ui/empty-state"
import { GroupedList, ListRow } from "@/components/ui/grouped-list"
import { PageBody, PageHeader } from "@/components/ui/page-header"
import { StatusPill } from "@/components/ui/status-pill"
import { groupStages, parseGroup } from "@/lib/candidate-groups"
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
    }
  }

  return (
    <>
      <PageHeader title="Candidates" description={plural(list.data.length, "candidate")} />
      <PageBody>
        <CandidateFilters group={group} jobId={jobId} search={search} jobs={jobs.data.map((j) => ({ id: j.id, title: j.title }))} />
        {detail && !detail.ok ? <QueryError message="Couldn't load that candidate." /> : null}
        {list.data.length === 0 ? (
          <div className="rounded-group bg-mist">
            <EmptyState message={search || jobId || group !== "all" ? "No candidates match these filters." : "No candidates yet."} />
          </div>
        ) : (
          <GroupedList>
            {list.data.map((c) => (
              <ListRow
                key={c.id}
                leading={<Avatar name={c.full_name} />}
                title={c.full_name}
                subtitle={c.current_title && c.current_company ? `${c.current_title} at ${c.current_company}` : c.current_title ?? undefined}
                value={c.job_title ?? undefined}
                pill={<StatusPill kind="candidate" value={c.stage} />}
                href={`/candidates?${new URLSearchParams({ ...(sp.g ? { g: sp.g } : {}), ...(jobId ? { job: jobId } : {}), ...(search ? { q: search } : {}), c: c.id }).toString()}`}
              />
            ))}
          </GroupedList>
        )}
        {profile ? <CandidateSheet key={profile.id} candidate={profile} /> : null}
      </PageBody>
    </>
  )
}
