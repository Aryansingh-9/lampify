"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { apiFetch, clearStoredTokens, getStoredAccessToken, setStoredTokens } from "@/lib/api";
import { supabaseBrowser } from "@/lib/supabase-browser";

export type UserProfile = {
  id: string;
  email: string;
  name: string | null;
  role: "STUDENT" | "ADMIN";
  subscription_tier: "FREE" | "WEEKLY" | "MONTHLY";
  free_attempts_remaining: number;
};

type AuthContextValue = {
  user: UserProfile | null;
  loading: boolean;
  refreshProfile: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string, name: string) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshProfile = useCallback(async () => {
    const token = getStoredAccessToken();
    if (!token) {
      setUser(null);
      setLoading(false);
      return;
    }
    try {
      const data = await apiFetch<{ id: string; email: string; name: string | null; role: string; subscription_tier: string; free_attempts_remaining: number }>(
        "/profile",
        { method: "GET" }
      );
      setUser({
        id: data.id,
        email: data.email,
        name: data.name,
        role: data.role as UserProfile["role"],
        subscription_tier: data.subscription_tier as UserProfile["subscription_tier"],
        free_attempts_remaining: data.free_attempts_remaining,
      });
    } catch {
      clearStoredTokens();
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshProfile();
  }, [refreshProfile]);

  const login = useCallback(async (email: string, password: string) => {
    const res = await apiFetch<{
      access_token: string;
      refresh_token: string;
      user: { id: string; email?: string; name?: string | null };
    }>("/auth/login", { method: "POST", json: { email, password } });
    setStoredTokens(res.access_token, res.refresh_token);
    await supabaseBrowser.auth.setSession({
      access_token: res.access_token,
      refresh_token: res.refresh_token,
    });
    await refreshProfile();
  }, [refreshProfile]);

  const signup = useCallback(async (email: string, password: string, name: string) => {
    const res = await apiFetch<{
      access_token?: string;
      refresh_token?: string;
      user?: { id: string; email?: string; name?: string | null };
    }>("/auth/signup", { method: "POST", json: { email, password, name } });
    if (res.access_token && res.refresh_token) {
      setStoredTokens(res.access_token, res.refresh_token);
      await supabaseBrowser.auth.setSession({
        access_token: res.access_token,
        refresh_token: res.refresh_token,
      });
    }
    await refreshProfile();
  }, [refreshProfile]);

  const logout = useCallback(async () => {
    try {
      await apiFetch("/auth/logout", { method: "POST" });
    } catch {
      /* ignore */
    }
    await supabaseBrowser.auth.signOut();
    clearStoredTokens();
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({ user, loading, refreshProfile, login, signup, logout }),
    [user, loading, refreshProfile, login, signup, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
