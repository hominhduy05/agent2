import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { User } from "@/lib/types";
import { getMe, getToken, removeToken } from "@/lib/api";

interface AuthContextValue {
  user: User | null;
  isLoading: boolean;
  isHydrated: boolean;
  login: (token: string, user: User) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  isLoading: false,
  isHydrated: false,
  login: () => {},
  logout: () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isHydrated, setIsHydrated] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const token = getToken();
    if (!token) {
      setIsLoading(false);
      setIsHydrated(true);
      return;
    }
    getMe()
      .then((u: User) => {
        setUser(u);
        setIsLoading(false);
        setIsHydrated(true);
      })
      .catch(() => {
        removeToken();
        setIsLoading(false);
        setIsHydrated(true);
      });
  }, []);

  function login(token: string, u: User) {
    setUser(u);
    setIsLoading(false);
    setIsHydrated(true);
    navigate("/dashboard");
  }

  function logout() {
    removeToken();
    setUser(null);
    navigate("/login");
  }

  return (
    <AuthContext.Provider value={{ user, isLoading, isHydrated, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
