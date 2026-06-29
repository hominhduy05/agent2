'use client';

import { createContext, useContext, useState, ReactNode } from 'react';

interface User {
  id: number;
  username: string;
  full_name: string;
  role: string;
}

interface AuthContextValue {
  user: User | null;
  isLoading: boolean;
  isHydrated: boolean;
  login: (token: string, user: User) => void;
  logout: () => void;
}

const DEFAULT_USER: User = {
  id: 1,
  username: 'admin',
  full_name: 'Administrator',
  role: 'admin',
};

const AuthContext = createContext<AuthContextValue>({
  user: DEFAULT_USER,
  isLoading: false,
  isHydrated: true,
  login: () => {},
  logout: () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user] = useState<User | null>(DEFAULT_USER);

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading: false,
        isHydrated: true,
        login: () => {},
        logout: () => {},
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
