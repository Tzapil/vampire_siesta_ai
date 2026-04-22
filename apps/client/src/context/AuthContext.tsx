import { createContext, startTransition, useContext, useEffect, useState, type ReactNode } from "react";
import { api } from "../api/client";
import type { AuthUserDto } from "../api/types";

type AuthContextValue = {
  isLoading: boolean;
  user: AuthUserDto | null;
  refresh: () => Promise<AuthUserDto | null>;
  logout: () => Promise<void>;
  setUser: (user: AuthUserDto | null) => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("Контекст авторизации недоступен");
  }
  return context;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUserState] = useState<AuthUserDto | null>(null);

  function setUser(nextUser: AuthUserDto | null) {
    startTransition(() => {
      setUserState(nextUser);
    });
  }

  async function refresh() {
    const data = await api.get<{ user: AuthUserDto | null }>("/auth/me");
    setUser(data.user);
    return data.user;
  }

  async function logout() {
    await api.post<{ ok: true }>("/auth/logout");
    setUser(null);
  }

  useEffect(() => {
    let active = true;

    async function bootstrap() {
      try {
        const data = await api.get<{ user: AuthUserDto | null }>("/auth/me");
        if (!active) return;
        setUser(data.user);
      } catch {
        if (!active) return;
        setUser(null);
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    }

    void bootstrap();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    function handleUnauthorized() {
      setIsLoading(false);
      setUser(null);
    }

    window.addEventListener("vs:auth-unauthorized", handleUnauthorized);
    return () => {
      window.removeEventListener("vs:auth-unauthorized", handleUnauthorized);
    };
  }, []);

  return (
    <AuthContext.Provider value={{ isLoading, user, refresh, logout, setUser }}>
      {children}
    </AuthContext.Provider>
  );
}
