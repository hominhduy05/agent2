import { cookies } from 'next/headers';
import { getUserFromToken } from './auth';
import { SIDEBAR_BY_ROLE } from './sidebar-config';

export async function getSidebar() {
  const cookieStore = await cookies();

  const token = cookieStore.get('auth')?.value;

  const user = getUserFromToken(token);

  if (!user) {
    return [];
  }

  return SIDEBAR_BY_ROLE[user.role as keyof typeof SIDEBAR_BY_ROLE];
}
