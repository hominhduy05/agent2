// lib/auth-users.ts

export type UserRole =
  | 'OWNER'
  | 'MANAGER'
  | 'ACCOUNTANT'
  | 'EMPLOYEE'
  | 'ADMIN';

export interface AuthUser {
  email: string;
  password: string;
  role: UserRole;
  name: string;
}

export const USERS: AuthUser[] = [
    {
    email: 'admin@gmail.com',
    password: 'AICamera@2026',
    role: 'ADMIN',
    name: 'System Administrator',
  },
  {
    email: 'owner@gmail.com',
    password: 'Owner@2026',
    role: 'OWNER',
    name: 'System Owner',
  },

  {
    email: 'manager@gmail.com',
    password: 'Manager@2026',
    role: 'MANAGER',
    name: 'Factory Manager',
  },

  {
    email: 'accountant@gmail.com',
    password: 'Accountant@2026',
    role: 'ACCOUNTANT',
    name: 'Accountant',
  },

  {
    email: 'employee@gmail.com',
    password: 'Employee@2026',
    role: 'EMPLOYEE',
    name: 'Employee',
  },
];