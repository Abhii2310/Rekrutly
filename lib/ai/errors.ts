import { APICallError, JSONParseError, NoObjectGeneratedError, NoOutputGeneratedError, TypeValidationError } from 'ai';

export type AiErrorCode = 'timeout' | 'invalid_output' | 'provider_error' | 'guardrail';

export type AiError = {
  code: AiErrorCode;
  message: string;
  /** HTTP status from the provider, when there was one. */
  status?: number;
};

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
  if (APICallError.isInstance(e)) {
    return { code: 'provider_error', message: `${FRIENDLY.provider_error} ${scrub(e.message)}`.trim(), status: e.statusCode };
  }
  if (
    NoObjectGeneratedError.isInstance(e) || NoOutputGeneratedError.isInstance(e) ||
    TypeValidationError.isInstance(e) || JSONParseError.isInstance(e)
  ) {
    return { code: 'invalid_output', message: FRIENDLY.invalid_output };
  }
  return { code: 'provider_error', message: `${FRIENDLY.provider_error} ${scrub(e instanceof Error ? e.message : String(e))}`.trim() };
}
