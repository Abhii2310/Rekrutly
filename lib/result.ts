export type AppError = { code: string; message: string; details?: unknown };
export type Result<T> = { ok: true; data: T } | { ok: false; error: AppError };

export function ok<T>(data: T): Result<T> {
  return { ok: true, data };
}

export function err<T = never>(code: string, message: string, details?: unknown): Result<T> {
  return { ok: false, error: { code, message, ...(details === undefined ? {} : { details }) } };
}
