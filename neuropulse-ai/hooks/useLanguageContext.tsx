"use client";

// ---------------------------------------------------------------------------
// LanguageProvider — Thai / English switcher (Task X).
//
// Holds the active language, persists it to localStorage ("app_language"),
// and exposes a `t(key, vars?)` helper that resolves strings from
// lib/i18n/translations. Default: Thai if the browser language starts with
// "th", otherwise English (English is the fallback, never a forced Thai).
//
// Hydration: the first (SSR) render is always "en" so the server and client
// markup match; the real stored/browser language is applied in a useEffect
// after mount. Worst case is a one-frame flash for Thai-default users.
// ---------------------------------------------------------------------------

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  ReactNode,
} from "react";
import { Language, translate } from "@/lib/i18n/translations";

const STORAGE_KEY = "app_language";

interface LanguageContextValue {
  lang: Language;
  setLang: (lang: Language) => void;
  t: (key: string, vars?: Record<string, string | number>) => string;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

function detectInitialLang(): Language {
  if (typeof window === "undefined") return "en"; // SSR — deterministic
  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (stored === "th" || stored === "en") return stored;
  const nav = (window.navigator.language || "").toLowerCase();
  return nav.startsWith("th") ? "th" : "en";
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  // Start on "en" for SSR/hydration parity, then sync to the real value.
  const [lang, setLangState] = useState<Language>("en");

  useEffect(() => {
    setLangState(detectInitialLang());
  }, []);

  const setLang = useCallback((next: Language) => {
    setLangState(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* storage unavailable (private mode) — in-memory only */
    }
  }, []);

  const t = useCallback(
    (key: string, vars?: Record<string, string | number>) =>
      translate(lang, key, vars),
    [lang]
  );

  const value = useMemo<LanguageContextValue>(
    () => ({ lang, setLang, t }),
    [lang, setLang, t]
  );

  return (
    <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
  );
}

export function useLanguage(): LanguageContextValue {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLanguage must be used within LanguageProvider");
  return ctx;
}
