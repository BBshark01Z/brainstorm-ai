"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { User, AuthTokens } from "@/lib/types";
import { apiFetch, FetchErrorType } from "@/lib/fetchWithHealth";
import { useLanguage } from "@/hooks/useLanguageContext";

// Errors are stored as translation keys (with optional interpolation vars)
// and resolved to display text at render time, so a language switch after
// the error appeared re-translates it without re-triggering the request.
export interface AuthError {
  key: string;
  vars?: Record<string, string | number>;
}

interface AuthResponse {
  access_token: string;
  token_type: string;
  user_id: string;
  email: string;
  nickname: string;
  created_at: string;
}

interface AuthContextValue {
  user: User | null;
  tokens: AuthTokens | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, nickname: string) => Promise<void>;
  logout: () => void;
  error: AuthError | null;
  /** The error message resolved in the current UI language. */
  errorText: string;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/** Throw a structured auth error (carries a translation key, not display text).
 *  Backend `detail` text is passed through untranslated (server-side dynamic
 *  content); only the fallback messages are translated. */
function throwAuthError(key: string, vars?: Record<string, string | number>): never {
  throw { key, vars };
}

/** Normalize a caught value into an AuthError. */
function toAuthError(err: unknown): AuthError {
  if (err && typeof err === "object" && "key" in err) {
    return err as AuthError;
  }
  return { key: "auth.err.unknown" };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const { t } = useLanguage();
  const [user, setUser] = useState<User | null>(null);
  const [tokens, setTokens] = useState<AuthTokens | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<AuthError | null>(null);

  useEffect(() => {
    const storedToken = localStorage.getItem("auth_token");
    const storedUser = localStorage.getItem("user");
    if (storedToken && storedUser) {
      try {
        setTokens(JSON.parse(storedToken));
        setUser(JSON.parse(storedUser));
      } catch {
        localStorage.removeItem("auth_token");
        localStorage.removeItem("user");
      }
    }
    setIsLoading(false);
  }, []);

  const login = async (email: string, password: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await apiFetch<{ access_token: string; token_type: string; user_id: number; email: string; nickname: string; created_at: string }>("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      if (!result.ok) {
        const err = result.error;
        if (err.type === FetchErrorType.NETWORK) {
          throwAuthError("auth.err.network");
        }
        if (err.detail) throwAuthError(err.detail);
        throwAuthError("auth.err.server", { status: err.status ?? "unknown" });
      }

      const data = result.data;
      setTokens({ access_token: data.access_token, token_type: data.token_type });
      const user: User = {
        user_id: data.user_id,
        email: data.email,
        nickname: data.nickname,
        created_at: data.created_at,
      };
      setUser(user);
      localStorage.setItem("auth_token", JSON.stringify({ access_token: data.access_token, token_type: data.token_type }));
      localStorage.setItem("user", JSON.stringify(user));
    } catch (err) {
      setError(toAuthError(err));
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (email: string, password: string, nickname: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await apiFetch<{ access_token: string; token_type: string; user_id: number; email: string; nickname: string; created_at: string }>("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, nickname }),
      });

      if (!result.ok) {
        const err = result.error;
        if (err.type === FetchErrorType.NETWORK) {
          throwAuthError("auth.err.network");
        }
        if (err.detail) throwAuthError(err.detail);
        throwAuthError("auth.err.server", { status: err.status ?? "unknown" });
      }

      // Auto-login after successful registration
      const loginResult = await apiFetch<{ access_token: string; token_type: string; user_id: number; email: string; nickname: string; created_at: string }>("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      if (!loginResult.ok) {
        const err = loginResult.error;
        if (err.type === FetchErrorType.NETWORK) {
          throwAuthError("auth.err.network");
        }
        if (err.detail) throwAuthError(err.detail);
        throwAuthError("auth.err.server", { status: err.status ?? "unknown" });
      }

      const loginData = loginResult.data;
      setTokens({ access_token: loginData.access_token, token_type: loginData.token_type });
      const user: User = {
        user_id: loginData.user_id,
        email: loginData.email,
        nickname: loginData.nickname,
        created_at: loginData.created_at,
      };
      setUser(user);
      localStorage.setItem("auth_token", JSON.stringify({ access_token: loginData.access_token, token_type: loginData.token_type }));
      localStorage.setItem("user", JSON.stringify(user));
    } catch (err) {
      setError(toAuthError(err));
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    setUser(null);
    setTokens(null);
    setError(null);
    localStorage.removeItem("auth_token");
    localStorage.removeItem("user");
  };

  const errorText = error ? t(error.key, error.vars) : "";

  return (
    <AuthContext.Provider value={{
      user, tokens, isLoading, isAuthenticated: !!user, login, register, logout, error, errorText,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
