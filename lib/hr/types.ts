import type { ResumeMatch } from '@/lib/ats/rules';

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

/** Everything the hiring-flow panels on a candidate need. Null when the database does not have migration 0004 yet. */
export type HrData = {
  resumeChars: number;
  match: ResumeMatch | null;
  shortlisted: boolean;
  interviews: InterviewView[];
  offers: OfferView[];
};

export const SCORECARD_AREAS = ['Problem solving', 'Communication', 'Role skills', 'Collaboration'] as const;
