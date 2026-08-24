"use client";

// ---------------------------------------------------------------------------
// LanguageToggle — compact TH / EN pill switcher.
//
// Uses the same glass/glow tokens as the rest of the Qn restyle (cyan active
// gradient, slate inactive) so it reads as part of the existing design
// system. Labels are "TH" / "EN" (unambiguous in both languages).
// ---------------------------------------------------------------------------

import { useLanguage } from "@/hooks/useLanguageContext";
import { Language } from "@/lib/i18n/translations";
import clsx from "clsx";

const OPTIONS: { value: Language; label: string }[] = [
  { value: "th", label: "TH" },
  { value: "en", label: "EN" },
];

export function LanguageToggle({ className }: { className?: string }) {
  const { lang, setLang } = useLanguage();

  return (
    <div
      role="group"
      aria-label="Language"
      className={clsx(
        "flex items-center gap-0.5 rounded-full p-0.5",
        className
      )}
      style={{
        background: "rgba(10, 15, 29, 0.7)",
        border: "1px solid rgba(30, 42, 61, 0.8)",
      }}
    >
      {OPTIONS.map(({ value, label }) => {
        const active = lang === value;
        return (
          <button
            key={value}
            type="button"
            onClick={() => setLang(value)}
            aria-pressed={active}
            className={clsx(
              "rounded-full px-2.5 py-1 text-[11px] font-semibold tracking-wide transition-all",
              active ? "text-white" : "text-slate-500 hover:text-slate-300"
            )}
            style={
              active
                ? {
                    background:
                      "linear-gradient(135deg, rgba(6, 182, 212, 0.25), rgba(139, 92, 246, 0.2))",
                    boxShadow: "0 0 12px -4px rgba(6, 182, 212, 0.5)",
                  }
                : undefined
            }
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
