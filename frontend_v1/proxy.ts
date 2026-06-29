// import { NextResponse } from 'next/server';
// import type { NextRequest } from 'next/server';

// export function middleware(request: NextRequest) {
//   const auth = request.cookies.get('auth')?.value;
//   const { pathname } = request.nextUrl;

//   const isLoggedIn = auth === 'true';

//   if (pathname.startsWith('/scada/monitor') && !isLoggedIn) {
//     return NextResponse.redirect(new URL('/login', request.url));
//   }

//   if (pathname === '/login' && isLoggedIn) {
//     return NextResponse.redirect(new URL('/scada/monitor', request.url));
//   }

//   return NextResponse.next();
// }

// export const config = {
//   matcher: ['/scada/:path*', '/login'],
// };

// middleware.ts

import { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { getUserFromToken } from './lib/auth';

export function middleware(req: NextRequest) {
  const token = req.cookies.get('auth')?.value;

  const user = getUserFromToken(token);

  if (!user) {
    return NextResponse.redirect(new URL('/login', req.url));
  }

  const path = req.nextUrl.pathname;

  // =====================
  // ADMIN ONLY
  // =====================

  if (path.startsWith('/admin') && user.role !== 'ADMIN') {
    return NextResponse.redirect(new URL('/403', req.url));
  }

  if (path.startsWith('/dataset') && user.role !== 'ADMIN') {
    return NextResponse.redirect(new URL('/403', req.url));
  }

  if (path.startsWith('/detect') && user.role !== 'ADMIN') {
    return NextResponse.redirect(new URL('/403', req.url));
  }

  // =====================
  // MANAGER + ADMIN
  // =====================

  if (
    path.startsWith('/camera-manager') &&
    !['ADMIN', 'MANAGER'].includes(user.role)
  ) {
    return NextResponse.redirect(new URL('/403', req.url));
  }

  // =====================
  // FINANCE
  // =====================

  if (
    path.startsWith('/finance') &&
    !['ADMIN', 'ACCOUNTANT', 'OWNER'].includes(user.role)
  ) {
    return NextResponse.redirect(new URL('/403', req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/admin/:path*',
    '/dataset/:path*',
    '/detect/:path*',
    '/finance/:path*',
    '/camera-manager/:path*',
  ],
};
