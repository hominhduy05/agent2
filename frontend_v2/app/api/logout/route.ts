import { NextResponse } from 'next/server';

export async function POST() {
  const response = NextResponse.json({
    success: true,
  });

  response.cookies.set('auth', '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: 0, // xoá cookie ngay lập tức
  });

  return response;
}