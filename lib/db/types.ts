// Hand-mirrored from supabase/migrations/0001_init.sql. Update both together (new migration, never in place).
import type {
  AssessmentStatus, DeliveryStatus, InvitationStatus, JobStatus, ReportStatus, RunStatus,
  ScoringStatus, Stage, StepStatus, TaskStatus, TaskType,
} from '@/lib/status';
import type { EventType } from '@/lib/events';

export type QuestionOptions = string[];
export type Rubric = { criteria: { point: string; weight: number }[]; model_answer: string };
export type SkillBreakdown = { skill: string; score: number; max: number; percent: number; question_ids: string[] }[];
export type TaskDraft = { language: 'en' | 'hi' | 'kn'; subject: string; body: string; whatsapp_text: string };
export type Json = Record<string, unknown>;

export type ActionName =
  | 'generate_questions' | 'create_assessment' | 'create_invitations' | 'send_invitations'
  | 'track_submissions' | 'score_and_report' | 'analyze_pipeline' | 'draft_followups';
export type Intent = 'create_assessment_workflow' | 'follow_up_sweep' | 'unsupported';
export type EventActor = 'recruiter' | 'agent' | 'system' | 'candidate';
export type EventLevel = 'info' | 'success' | 'warning' | 'error';

type Auto = 'id' | 'created_at' | 'updated_at';
type WithDefaults<R, K extends keyof R> = Partial<Pick<R, K>> & Omit<R, K>;

export type JobRow = {
  id: string; title: string; team: string | null; location: string | null; employment_type: string | null;
  description: string; skills: string[]; status: JobStatus; is_demo: boolean; created_at: string; updated_at: string;
};
export type JobInsert = WithDefaults<JobRow, Auto | 'team' | 'location' | 'employment_type' | 'description' | 'skills' | 'status' | 'is_demo'>;

export type CandidateRow = {
  id: string; job_id: string; full_name: string; email: string | null; phone: string | null;
  current_title: string | null; current_company: string | null; years_experience: number | null;
  location: string | null; skills: string[]; resume_summary: string; source: string | null;
  stage: Stage; is_demo: boolean; created_at: string; updated_at: string;
};
export type CandidateInsert = WithDefaults<CandidateRow,
  Auto | 'email' | 'phone' | 'current_title' | 'current_company' | 'years_experience' | 'location' | 'skills' | 'resume_summary' | 'source' | 'stage' | 'is_demo'>;

export type WorkflowRunRow = {
  id: string; instruction: string; intent: Intent; job_id: string | null; plan: Json; status: RunStatus;
  error: string | null; is_demo: boolean; created_at: string; updated_at: string;
  approved_at: string | null; completed_at: string | null;
};
export type WorkflowRunInsert = WithDefaults<WorkflowRunRow, Auto | 'job_id' | 'plan' | 'status' | 'error' | 'is_demo' | 'approved_at' | 'completed_at'>;

export type WorkflowStepRow = {
  id: string; run_id: string; position: number; action: ActionName; title: string; params: Json;
  requires_approval: boolean; status: StepStatus; result: Json | null; error: string | null; attempts: number;
  started_at: string | null; finished_at: string | null; created_at: string; updated_at: string;
};
export type WorkflowStepInsert = WithDefaults<WorkflowStepRow,
  Auto | 'params' | 'requires_approval' | 'status' | 'result' | 'error' | 'attempts' | 'started_at' | 'finished_at'>;

export type ApprovalRow = {
  id: string; run_id: string; decision: 'approved' | 'cancelled'; decided_by: string; snapshot: Json;
  note: string | null; created_at: string;
};
export type ApprovalInsert = WithDefaults<ApprovalRow, 'id' | 'created_at' | 'note'>;

export type AssessmentRow = {
  id: string; job_id: string; run_id: string | null; title: string; instructions: string; duration_minutes: number;
  skills: string[]; status: AssessmentStatus; is_demo: boolean; created_at: string; updated_at: string; published_at: string | null;
};
export type AssessmentInsert = WithDefaults<AssessmentRow, Auto | 'run_id' | 'instructions' | 'skills' | 'status' | 'is_demo' | 'published_at'>;

export type QuestionDifficulty = 'easy' | 'medium' | 'hard';
export type QuestionRow = {
  id: string; assessment_id: string; position: number; type: 'mcq' | 'short'; prompt: string;
  options: QuestionOptions | null; skill: string; difficulty: QuestionDifficulty; max_score: number;
  ai_generated: boolean; edited_by_recruiter: boolean; created_at: string; updated_at: string;
};
export type QuestionInsert = WithDefaults<QuestionRow, Auto | 'options' | 'ai_generated' | 'edited_by_recruiter'>;

export type QuestionKeyRow = { question_id: string; correct_option: number | null; rubric: Rubric | null; explanation: string | null };
export type QuestionKeyInsert = WithDefaults<QuestionKeyRow, 'correct_option' | 'rubric' | 'explanation'>;

export type InvitationRow = {
  id: string; assessment_id: string; candidate_id: string; token_hash: string; token_encrypted: string;
  status: InvitationStatus; delivery_status: DeliveryStatus; delivery_error: string | null; expires_at: string;
  consent_at: string | null; opened_at: string | null; started_at: string | null; deadline_at: string | null;
  submitted_at: string | null; current_question: number | null; last_activity_at: string | null;
  created_at: string; updated_at: string;
};
export type InvitationInsert = WithDefaults<InvitationRow,
  Auto | 'status' | 'delivery_status' | 'delivery_error' | 'consent_at' | 'opened_at' | 'started_at' | 'deadline_at' | 'submitted_at' | 'current_question' | 'last_activity_at'>;

export type AnswerRow = {
  id: string; invitation_id: string; question_id: string; selected_option: number | null;
  text_answer: string | null; saved_at: string;
};
export type AnswerInsert = WithDefaults<AnswerRow, 'id' | 'saved_at' | 'selected_option' | 'text_answer'>;

export type SubmissionRow = {
  id: string; invitation_id: string; submitted_at: string; auto_submitted: boolean;
  objective_score: number | null; objective_max: number | null; ai_suggested_score: number | null; ai_suggested_max: number | null;
  final_score: number | null; final_max: number | null; skill_breakdown: SkillBreakdown;
  scoring_status: ScoringStatus; scoring_error: string | null; report: Json | null; report_status: ReportStatus;
  report_error: string | null; is_simulated: boolean; created_at: string; updated_at: string;
};
export type SubmissionInsert = WithDefaults<SubmissionRow,
  Auto | 'submitted_at' | 'auto_submitted' | 'objective_score' | 'objective_max' | 'ai_suggested_score' | 'ai_suggested_max'
  | 'final_score' | 'final_max' | 'skill_breakdown' | 'scoring_status' | 'scoring_error' | 'report' | 'report_status' | 'report_error' | 'is_simulated'>;

export type Confidence = 'low' | 'medium' | 'high';
export type QuestionScoreRow = {
  id: string; submission_id: string; question_id: string; method: 'auto' | 'ai_suggested'; score: number; max_score: number;
  is_correct: boolean | null; unanswered: boolean; reasoning: string | null; evidence_quote: string | null;
  matched_criteria: string[] | null; missing_criteria: string[] | null; confidence: Confidence | null;
  overridden_score: number | null; override_reason: string | null; overridden_at: string | null;
  created_at: string; updated_at: string;
};
export type QuestionScoreInsert = WithDefaults<QuestionScoreRow,
  Auto | 'is_correct' | 'unanswered' | 'reasoning' | 'evidence_quote' | 'matched_criteria' | 'missing_criteria' | 'confidence'
  | 'overridden_score' | 'override_reason' | 'overridden_at'>;

export type IntegritySignalType = 'tab_hidden' | 'paste' | 'window_blur';
export type IntegritySignalRow = { id: number; invitation_id: string; type: IntegritySignalType; occurred_at: string };
export type IntegritySignalInsert = WithDefaults<IntegritySignalRow, 'id' | 'occurred_at'>;

export type TaskRow = {
  id: string; run_id: string | null; job_id: string | null; candidate_id: string | null; type: TaskType; title: string;
  detail: string | null; status: TaskStatus; due_at: string | null; draft: TaskDraft | null; dedupe_key: string | null;
  created_at: string; updated_at: string; completed_at: string | null;
};
export type TaskInsert = WithDefaults<TaskRow,
  Auto | 'run_id' | 'job_id' | 'candidate_id' | 'detail' | 'status' | 'due_at' | 'draft' | 'dedupe_key' | 'completed_at'>;

export type WorkflowEventRow = {
  id: number; run_id: string | null; step_id: string | null; job_id: string | null; candidate_id: string | null;
  type: EventType; actor: EventActor; level: EventLevel; message: string; data: Json; is_simulated: boolean; created_at: string;
};
export type WorkflowEventInsert = WithDefaults<WorkflowEventRow,
  'id' | 'created_at' | 'run_id' | 'step_id' | 'job_id' | 'candidate_id' | 'actor' | 'level' | 'data' | 'is_simulated'>;
