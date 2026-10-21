import { NextResponse } from 'next/server';

/** Standard route-handler responses: `{ data }` or `{ error: { code, message } }`. */
export function apiOk<T>(data: T, status = 200): NextResponse {
  return NextResponse.json({ data }, { status });
}

export function apiError(code: string, message: string, status: number): NextResponse {
  return NextResponse.json({ error: { code, message } }, { status });
}
