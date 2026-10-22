import type { ResumeMatch } from '@/lib/ats/rules';
import type { InterviewSummary, Turn } from '@/lib/ai-interview/rules';
import type { ChatMsg, FlawOutcome, TaskMetrics, TaskReview } from '@/lib/ai-task/rules';

/** What a recruiter writes after a live interview. Ratings are 1 to 5 per area; there is no overall "hire" field on purpose. */
export type Scorecard = { ratings: Record<string, number>; summary: string; savedAt: string };

export type InterviewView = {
  id: string;
  scheduledAt: string;
  durationMinutes: number;
  status: 'proposed' | 'scheduled' | 'completed' | 'cancelled';
  proposedSlots: string[] | null;
  notes: string;
  scorecard: Scorecard | null;
  emailStatus: 'not_sent' | 'sent' | 'failed';
};

export type OfferView = {
  id: string;
  title: string;
  compensation: string;
  startDate: string | null;
  body: string;
  status: 'draft' | 'sent';
  sentAt: string | null;
  response: 'accepted' | 'declined' | null;
};

export type AiInterviewView = { id: string; status: 'in_progress' | 'completed'; turns: Turn[]; summary: InterviewSummary | null; completedAt: string | null };

export type AiTaskView = {
  id: string; status: 'in_progress' | 'completed'; title: string; brief: string; deliverablePrompt: string;
  flaw: { wrongStatement: string; why: string };
  chat: ChatMsg[]; deliverable: string; metrics: (TaskMetrics & { outcome: FlawOutcome }) | null; review: TaskReview | null; completedAt: string | null;
};

/** Everything the hiring-flow panels on a candidate need. Null when the database does not have migration 0004 yet. */
export type HrData = {
  resumeChars: number;
  match: ResumeMatch | null;
  shortlisted: boolean;
  interviews: InterviewView[];
  offers: OfferView[];
  aiInterview: AiInterviewView | null;
  aiTask: AiTaskView | null;
};

export const SCORECARD_AREAS = ['Problem solving', 'Communication', 'Role skills', 'Collaboration'] as const;
