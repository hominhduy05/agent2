"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { useRouter } from "next/navigation";

export interface User {
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

const AuthContext = createContext<AuthContextValue>({
  user: null,
  isLoading: true,
  isHydrated: false,
  login: () => {},
  logout: () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isHydrated, setIsHydrated] = useState(false);
  const router = useRouter();

  useEffect(() => {
    // Client-side hydration check
    const storedUser = localStorage.getItem("sfds:auth:user");
    if (storedUser) {
      try {
        setUser(JSON.parse(storedUser));
      } catch (e) {
        localStorage.removeItem("sfds:auth:user");
        localStorage.removeItem("sfds:auth:token");
      }
    }
    setIsLoading(false);
    setIsHydrated(true);
  }, []);

  const login = (token: string, newUser: User) => {
    localStorage.setItem("sfds:auth:token", token);
    localStorage.setItem("sfds:auth:user", JSON.stringify(newUser));
    setUser(newUser);
  };

  const logout = () => {
    localStorage.removeItem("sfds:auth:token");
    localStorage.removeItem("sfds:auth:user");
    setUser(null);
    router.push("/login");
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, isHydrated, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
