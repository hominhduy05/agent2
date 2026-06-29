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
  const host = req.headers.get('host') || 'localhost:3000';
  const proto = process.env.NODE_ENV === 'production' ? 'https' : 'http';
  const res = NextResponse.redirect(`${proto}://${host}/login`);
  return clearAuth(res);
}

export async function GET(req: Request) {
  const host = req.headers.get('host') || 'localhost:3000';
  const proto = process.env.NODE_ENV === 'production' ? 'https' : 'http';
  const res = NextResponse.redirect(`${proto}://${host}/login`);
  return clearAuth(res);
}
