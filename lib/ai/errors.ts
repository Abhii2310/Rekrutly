import { APICallError, JSONParseError, NoObjectGeneratedError, NoOutputGeneratedError, TypeValidationError } from 'ai';

export type AiErrorCode = 'timeout' | 'invalid_output' | 'provider_error' | 'guardrail';

export type AiError = {
  code: AiErrorCode;
  message: string;
  /** HTTP status from the provider, when there was one. */
  status?: number;
  /** True when the call was not made because the model is cooling down after rate limits. */
  skipped?: boolean;
  /** True when the provider said the quota is used up. Waiting a few seconds will not help, so the next model is tried at once. */
  quota?: boolean;
  /** Seconds the provider asked us to wait, when it said. */
  retryAfterSec?: number;
};

/** Reads "Please retry in 16h20m18.2s" style hints into seconds. */
export function parseRetryAfter(message: string): number | undefined {
  const m = /retry in\s+(?:(\d+)h)?\s*(?:(\d+)m)?\s*(?:([\d.]+)s)?/i.exec(message);
  if (!m || (!m[1] && !m[2] && !m[3])) return undefined;
  return Math.round(Number(m[1] ?? 0) * 3600 + Number(m[2] ?? 0) * 60 + Number(m[3] ?? 0));
}

const FRIENDLY: Record<AiErrorCode, string> = {
  timeout: 'The AI took too long to answer.',
  invalid_output: 'The AI returned an answer in the wrong shape.',
  provider_error: "The AI provider couldn't be reached.",
  guardrail: 'That request was blocked by a guardrail.',
};

/** Keep provider messages short and make sure no key-like strings leak into logs or the UI. */
function scrub(message: string): string {
  return message.replace(/(AQ\.|AIza|sk-|sb_secret_)[A-Za-z0-9_\-.]+/g, '<redacted>').slice(0, 300);
}

export function classifyError(e: unknown): AiError {
  const name = e instanceof Error ? e.name : '';
  const causeName = e instanceof Error && e.cause instanceof Error ? e.cause.name : '';
  if (['TimeoutError', 'AbortError'].includes(name) || ['TimeoutError', 'AbortError'].includes(causeName)) {
    return { code: 'timeout', message: FRIENDLY.timeout };
  }
  if (APICallError.isInstance(e) && /does not match the expected schema|failed_generation|json_validate_failed/i.test(`${e.message} ${e.responseBody ?? ''}`)) {
    return { code: 'invalid_output', message: FRIENDLY.invalid_output };
  }
  if (APICallError.isInstance(e)) {
    const quota = /quota|exceeded your current|billing details/i.test(e.message);
    return { code: 'provider_error', message: `${FRIENDLY.provider_error} ${scrub(e.message)}`.trim(), status: e.statusCode, ...(quota ? { quota: true } : {}), ...(parseRetryAfter(e.message) !== undefined ? { retryAfterSec: parseRetryAfter(e.message) } : {}) };
  }
  if (
    NoObjectGeneratedError.isInstance(e) || NoOutputGeneratedError.isInstance(e) ||
    TypeValidationError.isInstance(e) || JSONParseError.isInstance(e)
  ) {
    return { code: 'invalid_output', message: FRIENDLY.invalid_output };
  }
  return { code: 'provider_error', message: `${FRIENDLY.provider_error} ${scrub(e instanceof Error ? e.message : String(e))}`.trim() };
}
