export type PortalInfo = {
  state: "invalid" | "expired" | "revoked" | "ready" | "in_progress" | "time_up" | "submitted"
  serverNow: string
  firstName: string
  jobTitle: string | null
  assessmentTitle: string | null
  durationMinutes: number | null
  questionCount: number | null
  proctored: boolean
  /** Set after submitting, when the assessment has an AI interview: not started, in progress or finished. */
  aiInterview: { status: "none" | "in_progress" | "completed" } | null
  aiInterviewAnnounced: boolean
  aiTask: { status: "none" | "in_progress" | "completed" } | null
  aiTaskAnnounced: boolean
  instructions: string | null
  deadlineAt: string | null
  submittedAt: string | null
  autoSubmitted: boolean
}

export type PortalQuestion = {
  id: string
  position: number
  type: "mcq" | "short"
  prompt: string
  options: string[] | null
  max_score: number
  skill: string
}

export type SavedAnswer = { question_id: string; selected_option: number | null; text_answer: string | null }
export type AnswerState = { selected: number | null; text: string }

export type QuestionsPayload = {
  questions: PortalQuestion[]
  answers: SavedAnswer[]
  deadlineAt: string
  serverNow: string
  currentQuestion: number | null
}

export type ApiResult<T> = { ok: true; data: T } | { ok: false; status: number; code: string; message: string }

const TIMEOUT_MS = 12_000
const RETRIES = 2

async function once<T>(token: string, path: string, init: RequestInit | undefined, timeoutMs: number): Promise<ApiResult<T>> {
  try {
    const res = await fetch(`/api/c/${token}${path}`, {
      ...init,
      headers: { "content-type": "application/json", ...(init?.headers ?? {}) },
      cache: "no-store",
      // A stalled connection (common on phones) must fail fast so it can be retried.
      signal: AbortSignal.timeout(timeoutMs),
    })
    const body = (await res.json().catch(() => null)) as { data?: T; error?: { code?: string; message?: string } } | null
    if (res.ok && body?.data !== undefined) return { ok: true, data: body.data }
    return { ok: false, status: res.status, code: body?.error?.code ?? "error", message: body?.error?.message ?? "Something went wrong." }
  } catch {
    return { ok: false, status: 0, code: "network", message: "No connection." }
  }
}

/**
 * All candidate calls go through here. Every candidate endpoint is safe to repeat (saves are upserts, start returns the
 * same deadline, submit answers 409 the second time), so a timeout or dropped connection is retried before giving up.
 * Network failures come back as status 0.
 */
export async function portalFetch<T>(token: string, path: string, init?: RequestInit, timeoutMs: number = TIMEOUT_MS): Promise<ApiResult<T>> {
  let last: ApiResult<T> = { ok: false, status: 0, code: "network", message: "No connection." }
  for (let attempt = 0; attempt <= RETRIES; attempt++) {
    last = await once<T>(token, path, init, timeoutMs)
    if (last.ok || last.status !== 0) return last
    await new Promise((r) => setTimeout(r, 400 * (attempt + 1)))
  }
  return last
}
