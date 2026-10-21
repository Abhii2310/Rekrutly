import { notFound } from "next/navigation"
import { QueryError } from "@/components/frame/query-error"
import { AIMark } from "@/components/ui/ai-mark"
import { PageBody, PageHeader } from "@/components/ui/page-header"
import { QuestionBuilder } from "@/components/questions/builder"
import { ProgressRail } from "@/components/ui/progress-rail"
import { Section } from "@/components/ui/section"
import { StatusPill } from "@/components/ui/status-pill"
import { DemoTag } from "@/components/ui/tags"
import { getAssessmentForReview } from "@/lib/db/queries/assessments"
import { getRunWithSteps } from "@/lib/db/queries/runs"
import { formatRelative } from "@/lib/format"
import { plural } from "@/lib/format-text"

export const dynamic = "force-dynamic"

export default async function RunPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ generate?: string }> }) {
  const { id } = await params
  const { generate } = await searchParams
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound()
  const [res, review] = await Promise.all([getRunWithSteps(id), getAssessmentForReview(id)])
  if (!res.ok || !review.ok) {
    return (
      <>
        <PageHeader title="Workflow" />
        <PageBody><QueryError message="Couldn't load this workflow." /></PageBody>
      </>
    )
  }
  if (!res.data) notFound()
  const { run, steps } = res.data
  const plan = run.plan
  const noEmail = plan.candidates.filter((c) => !c.has_email).length

  return (
    <>
      <PageHeader
        title={plan.job ? plan.job.title : "Workflow"}
        description={`Created ${formatRelative(run.created_at)}`}
        actions={<><StatusPill kind="run" value={run.status} />{run.is_demo ? <DemoTag /> : null}</>}
      />
      <PageBody>
        <div className="max-w-[720px]">
        <div className="flex items-start justify-between gap-4">
          <p className="t-body text-ink">{plan.summary}</p>
          <AIMark />
        </div>
        {plan.intent === "create_assessment_workflow" ? (
          <QuestionBuilder
            runId={run.id}
            steps={steps.map((s) => ({
              id: s.id, title: s.title, status: s.status, action: s.action,
              detail: typeof s.result?.message === "string" ? s.result.message : (s.error ?? undefined),
            }))}
            review={review.data}
            editable={review.data?.assessment.status === "draft" && ["draft", "awaiting_approval"].includes(run.status)}
            autoStart={generate === "1"}
            plannedCount={plan.assessment?.question_count ?? 10}
            warnings={(steps.find((s) => s.action === "generate_questions")?.result?.warnings as string[] | undefined) ?? []}
          />
        ) : (
          <Section title="Steps" className="mt-10">
            <ProgressRail steps={steps.map((s) => ({ id: s.id, title: s.title, status: s.status, detail: s.error ?? undefined }))} />
          </Section>
        )}
        <div className="t-callout mt-8 flex flex-col gap-1 text-ink-2">
          {plan.candidates.length > 0 ? <p>{plural(plan.candidates.length, "candidate")}{noEmail > 0 ? `, ${noEmail} without email` : ""}</p> : null}
          {plan.assumptions.length > 0 ? <p>Assumptions: {plan.assumptions.join(" ")}</p> : null}
        </div>
        </div>
      </PageBody>
    </>
  )
}
