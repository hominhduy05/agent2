import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const auth = request.cookies.get('auth')?.value;
  const { pathname } = request.nextUrl;

  const isLoggedIn = auth === 'true';

  if (pathname.startsWith('/scada') && !isLoggedIn) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  if (pathname === '/login' && isLoggedIn) {
    return NextResponse.redirect(new URL('/scada', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/scada/:path*', '/login'],
};