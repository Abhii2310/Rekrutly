import 'server-only';
import { notFound } from "next/navigation"
import { QueryError } from "@/components/frame/query-error"
import { QuestionBuilder } from "@/components/questions/builder"
import { ApprovalPanel } from "@/components/run/approval-panel"
import { RunLive } from "@/components/run/run-live"
import { SweepRun } from "@/components/run/sweep-run"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { previewSweep } from "@/lib/executor/approve-sweep"
import { AIMark } from "@/components/ui/ai-mark"
import { PageBody, PageHeader } from "@/components/ui/page-header"
import { ProgressRail } from "@/components/ui/progress-rail"
import { Section } from "@/components/ui/section"
import { Pill, StatusPill } from "@/components/ui/status-pill"
import { DemoTag } from "@/components/ui/tags"
import { env } from "@/lib/env"
import { getDb } from "@/lib/db/server"
import { getAssessmentForReview } from "@/lib/db/queries/assessments"
import { getRunLive } from "@/lib/db/queries/live"
import { getRunWithSteps } from "@/lib/db/queries/runs"
import { formatRelative } from "@/lib/format"
import { plural } from "@/lib/format-text"

export const dynamic = "force-dynamic"

export default async function RunPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ generate?: string }> }) {
  const { id } = await params
  const { generate } = await searchParams
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound()
  const [res, review, live] = await Promise.all([getRunWithSteps(id), getAssessmentForReview(id), getRunLive(id)])
  if (!res.ok || !review.ok || !live.ok) {
    return (
      <>
        <PageHeader title="Workflow" />
        <PageBody><QueryError message="Couldn't load this workflow." /></PageBody>
      </>
    )
  }
  if (!res.data || !live.data) notFound()
  const { run, steps } = res.data
  const plan = run.plan
  const isAssessmentFlow = plan.intent === "create_assessment_workflow"
  const beforeApproval = ["draft", "awaiting_approval"].includes(run.status)
  const questionCount = review.data?.questions.length ?? 0
  const canApprove = isAssessmentFlow && beforeApproval && review.data?.assessment.status === "draft" && questionCount >= 3

  // Current email addresses of the candidates in the plan (the plan only stored a has_email flag).
  let recipients: { id: string; name: string; email: string | null }[] = []
  if (canApprove) {
    const ids = plan.candidates.map((c) => c.id)
    const rows = await getDb().from("candidates").select("id, full_name, email").in("id", ids).order("created_at").order("id")
    recipients = ((rows.data ?? []) as { id: string; full_name: string; email: string | null }[]).map((r) => ({ id: r.id, name: r.full_name, email: r.email }))
  }

  const isSweep = plan.intent === "follow_up_sweep"
  const sweepPreview = isSweep && beforeApproval ? await previewSweep(run.job_id) : { targetRunId: null, targetTitle: null, recipients: [] }
  const sweepTarget = sweepPreview.targetRunId ?? ((plan as { target_run_id?: string }).target_run_id ?? null)
  const showWarRoom = isAssessmentFlow && !beforeApproval && run.status !== "cancelled"
  const noEmail = plan.candidates.filter((c) => !c.has_email).length

  return (
    <>
      <PageHeader
        title={plan.job ? plan.job.title : "Workflow"}
        description={`Created ${formatRelative(run.created_at)}`}
        actions={<>{showWarRoom ? <Button asChild variant="secondary" size="sm"><Link href={`/runs/${run.id}/war-room`}>Open War Room</Link></Button> : null}<StatusPill kind="run" value={run.status} />{run.is_demo ? <DemoTag /> : null}</>}
      />
      <PageBody>
        <div className="flex max-w-[720px] items-start justify-between gap-4">
          <p className="t-body text-ink">{plan.summary}</p>
          {plan.fallback ? <Pill>Saved</Pill> : <AIMark />}
        </div>

        {isAssessmentFlow && beforeApproval ? (
          <div className="mt-10 grid gap-10 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <QuestionBuilder
                runId={run.id}
                steps={steps.map((s) => ({
                  id: s.id, title: s.title, status: s.status, action: s.action,
                  detail: typeof s.result?.message === "string" ? s.result.message : (s.error ?? undefined),
                }))}
                review={review.data}
                editable={review.data?.assessment.status === "draft"}
                autoStart={generate === "1"}
                plannedCount={plan.assessment?.question_count ?? 10}
                warnings={(steps.find((s) => s.action === "generate_questions")?.result?.warnings as string[] | undefined) ?? []}
                demoMode={env.DEMO_MODE}
                saved={steps.find((s) => s.action === "generate_questions")?.result?.fallback === true}
              />
            </div>
            {canApprove ? (
              <div className="lg:sticky lg:top-32 lg:self-start">
                <ApprovalPanel
                  runId={run.id}
                  roleTitle={plan.job?.title ?? "open"}
                  initialMinutes={review.data?.assessment.duration_minutes ?? 30}
                  recipients={recipients}
                  questionCount={questionCount}
                />
              </div>
            ) : null}
          </div>
        ) : isAssessmentFlow ? (
          <div className="mt-10">
            {run.status === "cancelled" ? (
              <div role="note" className="mb-8 max-w-[720px] rounded-group bg-mist p-4">
                <p className="t-body text-ink">This workflow was cancelled. Nothing was sent.</p>
              </div>
            ) : null}
            <RunLive runId={run.id} initial={live.data} />
          </div>
        ) : isSweep ? (
          <SweepRun runId={run.id} initial={live.data} beforeApproval={beforeApproval} cancelled={run.status === "cancelled"} preview={sweepPreview} targetRunId={sweepTarget} />
        ) : (
          <Section title="Steps" className="mt-10">
            <div className="max-w-[720px]">
              <ProgressRail steps={steps.map((s) => ({ id: s.id, title: s.title, status: s.status, detail: s.error ?? undefined }))} />
            </div>
            <div className="t-callout mt-8 flex flex-col gap-1 text-ink-2">
              {plan.candidates.length > 0 ? <p>{plural(plan.candidates.length, "candidate")}{noEmail > 0 ? `, ${noEmail} without email` : ""}</p> : null}
              {plan.assumptions.length > 0 ? <p>Assumptions: {plan.assumptions.join(" ")}</p> : null}
            </div>
          </Section>
        )}
      </PageBody>
    </>
  )
}
