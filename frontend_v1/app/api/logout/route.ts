// app/api/logout/route.ts

import { NextResponse } from 'next/server';

function clearAuth(res: NextResponse) {
  res.cookies.set('auth', '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: 0,
  });

  return res;
}

export async function POST(req: Request) {
  const res = NextResponse.redirect(
    new URL('/login', req.url)
  );

  return clearAuth(res);
}

export async function GET(req: Request) {
  const res = NextResponse.redirect(
    new URL('/login', req.url)
  );

  return clearAuth(res);
}