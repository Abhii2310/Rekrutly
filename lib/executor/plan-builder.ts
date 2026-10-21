import type { ActionName } from '@/lib/db/types';
import { plural } from '@/lib/format-text';
import type { ResolvedPlan } from '@/lib/ai/resolve-plan';

export type StepDef = {
  position: number;
  action: ActionName;
  title: string;
  params: Record<string, unknown>;
  requires_approval: boolean;
  /** Approval-requiring steps start as awaiting_approval, the rest as planned. */
  status: 'planned' | 'awaiting_approval';
};

type Spec = Omit<StepDef, 'position' | 'status'>;

function createAssessmentSteps(plan: ResolvedPlan): Spec[] {
  const a = plan.assessment;
  if (!a || !plan.job) return [];
  const ids = plan.candidates.map((c) => c.id);
  const withEmail = plan.candidates.filter((c) => c.has_email).map((c) => c.id);
  return [
    {
      action: 'generate_questions', requires_approval: false, title: `Write ${a.question_count} questions`,
      params: { jobId: plan.job.id, skills: a.skills, count: a.question_count, durationMinutes: a.duration_minutes, types: a.question_types, difficulty: a.difficulty },
    },
    { action: 'create_assessment', requires_approval: true, title: 'Create the assessment', params: { title: a.title, durationMinutes: a.duration_minutes } },
    { action: 'create_invitations', requires_approval: true, title: `Create ${plural(ids.length, 'candidate link')}`, params: { candidateIds: ids } },
    {
      action: 'send_invitations', requires_approval: true,
      title: withEmail.length ? `Send invitations to ${plural(withEmail.length, 'candidate')} with email` : 'Send invitations by email',
      params: { candidateIds: withEmail },
    },
    { action: 'track_submissions', requires_approval: false, title: 'Track submissions', params: {} },
    { action: 'score_and_report', requires_approval: false, title: 'Score and prepare reports', params: {} },
  ];
}

function followUpSteps(plan: ResolvedPlan): Spec[] {
  const params = { jobId: plan.job?.id ?? null };
  return [
    { action: 'analyze_pipeline', requires_approval: true, title: 'Review the pipeline and find blockers', params },
    { action: 'draft_followups', requires_approval: true, title: 'Draft follow-up messages', params },
  ];
}

/** Pure. Steps come from a template per intent; the model never decides them. */
export function buildSteps(plan: ResolvedPlan): StepDef[] {
  const specs =
    plan.intent === 'create_assessment_workflow' ? createAssessmentSteps(plan)
    : plan.intent === 'follow_up_sweep' ? followUpSteps(plan)
    : [];
  return specs.map((s, position) => ({ ...s, position, status: s.requires_approval ? 'awaiting_approval' : 'planned' }));
}
