"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { User, AuthTokens } from "@/lib/types";
import { apiFetch, FetchErrorType } from "@/lib/fetchWithHealth";

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
  error: string | null;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * Attempt to parse an error response from the backend.
 *
 * FastAPI returns structured JSON on validation / HTTPException:
 *   { "detail": "..." }
 *
 * On network errors (ECONNREFUSED, etc.) `fetch` throws a TypeError
 * before we ever see a Response, so the caller must handle that case.
 */
async function parseApiError(res: Response): Promise<string> {
  const data = await res.json().catch(() => ({}));
  const backendMsg = data.detail || data.message || "";

  if (res.status === 401) {
    return backendMsg || "Invalid email or password";
  }
  if (res.status === 400) {
    return backendMsg || "Invalid input. Please check your data and try again";
  }
  if (res.status === 409) {
    return backendMsg || "This email is already registered";
  }
  return backendMsg || `Server error (${res.status})`;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [tokens, setTokens] = useState<AuthTokens | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
          throw new Error("Cannot connect to the backend server (please ensure Uvicorn is running on port 8765)");
        }
        throw new Error(err.detail || `Server error (${err.status})`);
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
      setError(err instanceof Error ? err.message : "Unknown error");
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
          throw new Error("Cannot connect to the backend server (please ensure Uvicorn is running on port 8765)");
        }
        throw new Error(err.detail || `Server error (${err.status})`);
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
          throw new Error("Cannot connect to the backend server (please ensure Uvicorn is running on port 8765)");
        }
        throw new Error(err.detail || `Server error (${err.status})`);
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
      setError(err instanceof Error ? err.message : "Unknown error");
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

  return (
    <AuthContext.Provider value={{
      user, tokens, isLoading, isAuthenticated: !!user, login, register, logout, error,
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
