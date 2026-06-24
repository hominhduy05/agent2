import { createHmac } from 'crypto';
import { NextResponse } from 'next/server';
import { USERS } from '@/lib/auth-users';

const SECRET =
  process.env.AUTH_SECRET ||
  'super-secret-key-change-me';

function sign(payload: string) {
  return createHmac('sha256', SECRET)
    .update(payload)
    .digest('hex');
}

export async function POST(req: Request) {
  const formData = await req.formData();

  const email = String(
    formData.get('email') || ''
  );

  const password = String(
    formData.get('password') || ''
  );

  const remember =
    formData.get('remember');

  const user = USERS.find(
    u =>
      u.email === email &&
      u.password === password
  );

  if (!user) {
    return NextResponse.redirect(
      new URL(
        `/login?error=1&email=${encodeURIComponent(
          email
        )}`,
        req.url
      )
    );
  }

  const payload = JSON.stringify({
    email: user.email,
    role: user.role,
    name: user.name,
  });

  const token =
    Buffer.from(payload).toString(
      'base64'
    ) +
    '.' +
    sign(payload);

  const maxAge =
    remember === 'on'
      ? 60 * 60 * 24 * 30
      : 60 * 60 * 24;

  let redirectUrl =
    '/scada/dashboard';

  switch (user.role) {
    case 'ADMIN':
      redirectUrl =
        '/scada/dashboard';
      break;

    case 'OWNER':
      redirectUrl =
        '/analytics';
      break;

    case 'MANAGER':
      redirectUrl =
        '/scada/dashboard';
      break;

    case 'ACCOUNTANT':
      redirectUrl =
        '/statistics/fruits';
      break;

    case 'EMPLOYEE':
      redirectUrl =
        '/employee/summary';
      break;
  }

  const res = NextResponse.redirect(
    new URL(redirectUrl, req.url)
  );

  res.cookies.set('auth', token, {
    httpOnly: true,
    secure:
      process.env.NODE_ENV ===
      'production',
    sameSite: 'strict',
    path: '/',
    maxAge,
  });

  return res;
}