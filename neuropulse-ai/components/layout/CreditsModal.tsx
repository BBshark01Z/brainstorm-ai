"use client";

// ---------------------------------------------------------------------------
// CreditsModal — glassmorphism "About the Developers" modal.
//
// Opened from the ✨ button in the Header (next to the TH/EN toggle) and the
// "Credits" item in the Sidebar. Shows the SMTE competition attribution,
// developer credit, and the full technical breakdown of the project.
// ---------------------------------------------------------------------------

import { useEffect, useState } from "react";
import { Sparkles, X, Cpu, Monitor } from "lucide-react";
import { useLanguage } from "@/hooks/useLanguageContext";

const TECH_BADGES = [
  "Next.js",
  "FastAPI",
  "Python",
  "SQLite",
  "Qwen/DeepSeek LLM",
  "Tailwind CSS",
  "Render",
  "Vercel",
];

export function CreditsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useLanguage();

  // Two-stage render so the modal can fade/scale out on close, not just in.
  const [render, setRender] = useState(open);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    if (open) {
      setRender(true);
      const raf = requestAnimationFrame(() =>
        requestAnimationFrame(() => setShown(true))
      );
      return () => cancelAnimationFrame(raf);
    }
    setShown(false);
    const id = setTimeout(() => setRender(false), 220);
    return () => clearTimeout(id);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!render) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t("credits.title")}
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{
        background: "rgba(4, 6, 12, 0.6)",
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
        opacity: shown ? 1 : 0,
        transition: "opacity 200ms ease",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-2xl overflow-hidden rounded-2xl"
        style={{
          background: "linear-gradient(160deg, rgba(14, 19, 31, 0.92), rgba(10, 15, 29, 0.96))",
          border: "1px solid rgba(6, 182, 212, 0.25)",
          backdropFilter: "blur(16px)",
          WebkitBackdropFilter: "blur(16px)",
          boxShadow:
            "0 0 40px -8px rgba(6, 182, 212, 0.35), 0 0 60px -12px rgba(139, 92, 246, 0.25), inset 0 1px 0 rgba(255, 255, 255, 0.06)",
          transform: shown ? "translateY(0) scale(1)" : "translateY(12px) scale(0.97)",
          transition: "transform 220ms cubic-bezier(0.2, 0.8, 0.3, 1)",
          maxHeight: "85vh",
          overflowY: "auto",
        }}
      >
        {/* Top accent line */}
        <div
          className="h-0.5 w-full"
          style={{
            background: "linear-gradient(90deg, transparent, #06B6D4, #8B5CF6, transparent)",
          }}
        />

        <div className="p-6 sm:p-8">
          {/* Header */}
          <div className="mb-6 flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div
                className="flex h-11 w-11 items-center justify-center rounded-xl"
                style={{
                  background: "linear-gradient(135deg, rgba(6, 182, 212, 0.18), rgba(139, 92, 246, 0.18))",
                  border: "1px solid rgba(6, 182, 212, 0.3)",
                  boxShadow: "0 0 20px -5px rgba(6, 182, 212, 0.4)",
                }}
              >
                <Sparkles size={20} className="text-cyan-400" />
              </div>
              <div>
                <h2 className="font-display text-lg font-semibold text-white">
                  {t("credits.title")}
                </h2>
                <p className="text-xs text-slate-500">Brainstorm AI · NeuroPulse</p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label={t("credits.close")}
              className="rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-white/5 hover:text-white"
            >
              <X size={18} />
            </button>
          </div>

          {/* Developer & SMTE attribution */}
          <div
            className="mb-6 rounded-xl p-4"
            style={{
              background: "linear-gradient(135deg, rgba(6, 182, 212, 0.08), rgba(139, 92, 246, 0.08))",
              border: "1px solid rgba(6, 182, 212, 0.2)",
            }}
          >
            <p className="text-[10px] font-semibold uppercase tracking-widest text-cyan-400/80">
              {t("credits.devLabel")}
            </p>
            <p className="mt-1 font-display text-base font-semibold text-white">
              Paphatsapong Pengpark
            </p>
            <p className="mt-3 text-xs leading-relaxed text-slate-300">
              {t("credits.smteNotice")}
            </p>
          </div>

          {/* Tech stack badges */}
          <div className="mb-6">
            <p className="mb-2.5 text-[10px] font-semibold uppercase tracking-widest text-slate-500">
              {t("credits.techStack")}
            </p>
            <div className="flex flex-wrap gap-2">
              {TECH_BADGES.map((badge) => (
                <span
                  key={badge}
                  className="rounded-full px-3 py-1 text-[11px] font-medium text-slate-200"
                  style={{
                    background: "rgba(20, 26, 40, 0.8)",
                    border: "1px solid rgba(30, 38, 54, 0.9)",
                  }}
                >
                  {badge}
                </span>
              ))}
            </div>
          </div>

          {/* Technical breakdown */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div
              className="rounded-xl p-4"
              style={{
                background: "rgba(10, 15, 29, 0.6)",
                border: "1px solid rgba(30, 38, 54, 0.8)",
              }}
            >
              <div className="mb-3 flex items-center gap-2">
                <Cpu size={15} className="text-violet-400" />
                <h3 className="font-display text-sm font-semibold text-white">
                  {t("credits.backendTitle")}
                </h3>
              </div>
              <ul className="space-y-2">
                {["backend1", "backend2", "backend3", "backend4", "backend5"].map((k) => (
                  <li key={k} className="flex gap-2 text-xs leading-relaxed text-slate-400">
                    <span className="mt-1.5 h-1 w-1 flex-shrink-0 rounded-full bg-violet-400" />
                    <span>{t(`credits.backend.${k}`)}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div
              className="rounded-xl p-4"
              style={{
                background: "rgba(10, 15, 29, 0.6)",
                border: "1px solid rgba(30, 38, 54, 0.8)",
              }}
            >
              <div className="mb-3 flex items-center gap-2">
                <Monitor size={15} className="text-cyan-400" />
                <h3 className="font-display text-sm font-semibold text-white">
                  {t("credits.frontendTitle")}
                </h3>
              </div>
              <ul className="space-y-2">
                {["frontend1", "frontend2", "frontend3", "frontend4", "frontend5"].map((k) => (
                  <li key={k} className="flex gap-2 text-xs leading-relaxed text-slate-400">
                    <span className="mt-1.5 h-1 w-1 flex-shrink-0 rounded-full bg-cyan-400" />
                    <span>{t(`credits.frontend.${k}`)}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
