import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { getUserFromToken } from '@/lib/auth';

export async function GET() {
  const token = (await cookies()).get('auth')?.value;

  const user = getUserFromToken(token);

  if (!user) {
    return NextResponse.json(null, {
      status: 401,
    });
  }

  return NextResponse.json(user);
}
