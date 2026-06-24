import { createHmac } from 'crypto';

const SECRET =
  process.env.AUTH_SECRET ||
  'super-secret-key-change-me';

function sign(payload: string) {
  return createHmac('sha256', SECRET)
    .update(payload)
    .digest('hex');
}

export function getUserFromToken(
  token?: string
) {
  if (!token) return null;

  const [data, hash] =
    token.split('.');

  const payload = Buffer.from(
    data,
    'base64'
  ).toString();

  if (sign(payload) !== hash) {
    return null;
  }

  return JSON.parse(payload) as {
    email: string;
    role:
      | 'ADMIN'
      | 'OWNER'
      | 'MANAGER'
      | 'ACCOUNTANT'
      | 'EMPLOYEE';
    name: string;
  };
}