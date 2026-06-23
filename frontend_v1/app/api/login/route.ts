// app/api/login/route.ts

import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  const { email, password } = await req.json();

  if (email === 'admin8386@gmail.com' && password === 'AICamera@2026') {
    const response = NextResponse.json({
      success: true,
    });

    response.cookies.set('auth', 'true', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/',
      maxAge: 60 * 60 * 24 * 7,
    });

    return response;
  }

  return NextResponse.json(
    {
      success: false,
      message: 'Email hoặc mật khẩu không đúng',
    },
    { status: 401 }
  );
}
