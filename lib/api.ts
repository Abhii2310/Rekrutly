import { NextResponse } from 'next/server';

/** Standard route-handler responses: `{ data }` or `{ error: { code, message } }`. */
export function apiOk<T>(data: T, status = 200): NextResponse {
  return NextResponse.json({ data }, { status });
}

export function apiError(code: string, message: string, status: number): NextResponse {
  return NextResponse.json({ error: { code, message } }, { status });
}

/**
 * Wraps a route handler so an unexpected error never leaks details: the person gets the standard error shape with a
 * generic message and a 500, and the real error is logged on the server (never with request bodies or tokens).
 */
export function withErrors<A extends unknown[]>(handler: (...args: A) => Promise<Response>): (...args: A) => Promise<Response> {
  return async (...args: A) => {
    try {
      return await handler(...args);
    } catch (e) {
      console.error('route failed:', e instanceof Error ? `${e.name}: ${e.message}` : 'unknown error');
      return apiError('server_error', 'Something went wrong on our side. Try again.', 500);
    }
  };
}
