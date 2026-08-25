"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import { Activity, Fingerprint, LineChart, Bot, Brain, Sparkles } from "lucide-react";
import { useLanguage } from "@/hooks/useLanguageContext";

const NAV_ITEMS = [
  { href: "/dashboard", label: "nav.home", icon: Activity },
  { href: "/brainprint", label: "nav.brainprint", icon: Fingerprint },
  { href: "/analytics", label: "nav.analytics", icon: LineChart },
  { href: "/ai-consultant", label: "nav.aiConsultant", icon: Bot },
];

export function Sidebar({ onOpenCredits }: { onOpenCredits?: () => void }) {
  const pathname = usePathname();
  const { t } = useLanguage();

  return (
    <aside
      className="hidden w-60 flex-col border-r lg:flex"
      style={{
        borderRightColor: "rgba(30, 42, 61, 0.6)",
        background: "linear-gradient(180deg, rgba(10, 15, 29, 0.98) 0%, rgba(6, 8, 16, 0.95) 100%)",
      }}
    >
      {/* Top accent line */}
      <div
        className="h-0.5 w-full"
        style={{
          background: "linear-gradient(90deg, transparent, #06B6D4, #8B5CF6, transparent)",
          opacity: 0.6,
        }}
      />

      {/* Logo */}
      <div className="mb-8 mt-6 flex items-center gap-2.5 px-4">
        <div
          className="relative flex h-10 w-10 items-center justify-center rounded-xl"
          style={{
            background: "linear-gradient(135deg, rgba(6, 182, 212, 0.15), rgba(139, 92, 246, 0.15))",
            border: "1px solid rgba(6, 182, 212, 0.2)",
            boxShadow: "0 0 20px -5px rgba(6, 182, 212, 0.2)",
          }}
        >
          <Brain size={20} className="text-cyan-400" />
        </div>
        <div>
          <p className="font-display text-sm font-bold leading-tight text-white">
            Brain<span className="text-cyan-400">storm</span>
          </p>
          <p className="font-display text-[10px] font-semibold leading-tight tracking-widest text-violet-400/70">AI</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex flex-1 flex-col gap-1.5 px-3">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className={clsx(
                "group relative flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition-all",
                active
                  ? "text-white"
                  : "text-slate-400 hover:text-white"
              )}
              style={{
                background: active
                  ? "linear-gradient(135deg, rgba(6, 182, 212, 0.15), rgba(139, 92, 246, 0.1))"
                  : "transparent",
                border: active
                  ? "1px solid rgba(6, 182, 212, 0.25)"
                  : "1px solid transparent",
                boxShadow: active
                  ? "0 0 20px -5px rgba(6, 182, 212, 0.15)"
                  : "none",
              }}
            >
              {/* Active indicator */}
              {active && (
                <div
                  className="absolute left-0 top-1/2 h-4 w-0.5 -translate-y-1/2 rounded-full"
                  style={{ background: "#06B6D4", boxShadow: "0 0 8px #06B6D4" }}
                />
              )}
              <Icon
                size={18}
                strokeWidth={2}
                className={clsx(
                  "transition-colors",
                  active ? "text-cyan-400" : "text-slate-500 group-hover:text-slate-300"
                )}
              />
              {t(label)}
            </Link>
          );
        })}

        {/* Credits — opens the SMTE attribution modal, not a route */}
        <button
          type="button"
          onClick={onOpenCredits}
          className="group relative flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium text-slate-400 transition-all hover:text-white"
          style={{ border: "1px solid transparent" }}
        >
          <Sparkles
            size={18}
            strokeWidth={2}
            className="text-slate-500 transition-colors group-hover:text-amber-300"
          />
          {t("nav.credits")}
        </button>
      </nav>

      {/* Bottom status */}
      <div className="mt-auto border-t px-4 py-4" style={{ borderColor: "rgba(30, 42, 61, 0.4)" }}>
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-emerald-400" style={{ boxShadow: "0 0 6px #10B981" }} />
          <span className="text-[10px] font-mono uppercase tracking-wider text-slate-500">{t("nav.systemOnline")}</span>
        </div>
      </div>
    </aside>
  );
}
