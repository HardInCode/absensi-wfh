import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import axios from "axios";
import { api, AUTH_EXPIRED_EVENT, TOKEN_KEY } from "@/lib/api";
import { normalizeEmployee, pickStr, type Employee } from "@/lib/hrdApi";

export type AuthUser = Employee;

interface AuthContextValue {
  user: AuthUser | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<AuthUser>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function parseMe(data: unknown): AuthUser {
  const root = typeof data === "object" && data !== null ? (data as Record<string, unknown>) : {};
  return normalizeEmployee(root.user ?? root);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(() => Boolean(localStorage.getItem(TOKEN_KEY)));

  useEffect(() => {
    if (!localStorage.getItem(TOKEN_KEY)) {
      setIsLoading(false);
      return;
    }
    const controller = new AbortController();
    api
      .get("/auth/me", { signal: controller.signal })
      .then((res) => setUser(parseMe(res.data)))
      .catch((error: unknown) => {
        if (axios.isCancel(error)) return;
        localStorage.removeItem(TOKEN_KEY);
        setUser(null);
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoading(false);
      });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const onExpired = () => setUser(null);
    window.addEventListener(AUTH_EXPIRED_EVENT, onExpired);
    return () => window.removeEventListener(AUTH_EXPIRED_EVENT, onExpired);
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const res = await api.post("/auth/login", { email, password });
    const token = pickStr(res.data, "accessToken", "access_token", "token");
    if (!token) throw new Error("Respons login tidak berisi token.");
    localStorage.setItem(TOKEN_KEY, token);
    try {
      const me = await api.get("/auth/me");
      const nextUser = parseMe(me.data);
      setUser(nextUser);
      return nextUser;
    } catch (error) {
      localStorage.removeItem(TOKEN_KEY);
      throw error;
    }
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    setUser(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ user, isLoading, login, logout }),
    [user, isLoading, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth harus dipakai di dalam AuthProvider.");
  return ctx;
}
