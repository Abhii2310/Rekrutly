import { NextResponse, type NextRequest } from 'next/server';
import { SESSION_COOKIE, verifySessionValue } from '@/lib/security/session';

const PUBLIC_PREFIXES = ['/login', '/api/auth/', '/a/', '/api/c/', '/api/health', '/_next/'];

function isPublic(pathname: string): boolean {
  return pathname === '/favicon.ico' || PUBLIC_PREFIXES.some((p) => pathname === p.replace(/\/$/, '') || pathname.startsWith(p));
}

export function proxy(request: NextRequest): NextResponse {
  const { pathname, search } = request.nextUrl;
  // The Demo Director page exists only in DEMO_MODE. Elsewhere it is a real 404, not a page that says "not found".
  if ((pathname === '/demo' || pathname.startsWith('/demo/')) && process.env.DEMO_MODE !== 'true') {
    return NextResponse.rewrite(new URL('/not-found-demo', request.url), { status: 404 });
  }
  const signedIn = verifySessionValue(request.cookies.get(SESSION_COOKIE)?.value);

  if (pathname === '/login' && signedIn) {
    const next = request.nextUrl.searchParams.get('next');
    const target = next && next.startsWith('/') && !next.startsWith('//') ? next : '/';
    return NextResponse.redirect(new URL(target, request.url));
  }
  if (isPublic(pathname) || signedIn) return NextResponse.next();

  if (pathname.startsWith('/api/')) {
    return NextResponse.json({ error: { code: 'unauthorized', message: 'Sign in to continue.' } }, { status: 401 });
  }
  const url = new URL('/login', request.url);
  url.searchParams.set('next', `${pathname}${search}`);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
