"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { LanguageToggle } from "@/components/ui/LanguageToggle";
import { useLanguage } from "@/hooks/useLanguageContext";
import { Brain, Eye, Shield } from "lucide-react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { login, errorText } = useAuth();
  const { t } = useLanguage();
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await login(email, password);
      router.push("/dashboard");
      router.refresh();
    } catch {
      // Error is handled by useAuth
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#060810] px-4">
      {/* Animated background grid */}
      <div
        className="pointer-events-none absolute inset-0 opacity-20"
        style={{
          backgroundImage: `
            linear-gradient(rgba(6, 182, 212, 0.15) 1px, transparent 1px),
            linear-gradient(90deg, rgba(6, 182, 212, 0.15) 1px, transparent 1px)
          `,
          backgroundSize: "60px 60px",
          animation: "scan-sweep 8s linear infinite",
        }}
      />

      {/* Ambient glow */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background: "radial-gradient(ellipse at 50% 30%, rgba(139, 92, 246, 0.12) 0%, transparent 60%)",
        }}
      />

      {/* Floating particles */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {[...Array(6)].map((_, i) => (
          <div
            key={i}
            className="absolute rounded-full bg-cyan-400/20"
            style={{
              width: `${2 + Math.random() * 4}px`,
              height: `${2 + Math.random() * 4}px`,
              left: `${10 + Math.random() * 80}%`,
              top: `${10 + Math.random() * 80}%`,
              animation: `float ${3 + Math.random() * 4}s ease-in-out ${i * 0.5}s infinite`,
            }}
          />
        ))}
      </div>

      {/* Card */}
      <div
        className="glass-raised rise-in relative w-full max-w-md overflow-hidden rounded-2xl"
        style={{
          boxShadow:
            "0 0 60px -12px rgba(6, 182, 212, 0.22), 0 0 120px -24px rgba(139, 92, 246, 0.12)",
        }}
      >
        {/* Language toggle — top-right of the card */}
        <div className="absolute right-4 top-4">
          <LanguageToggle />
        </div>

        {/* Top accent line */}
        <div
          className="h-0.5 w-full"
          style={{
            background: "linear-gradient(90deg, transparent, #06B6D4, #8B5CF6, transparent)",
            animation: "gradient-shift 4s ease infinite",
            backgroundSize: "200% 200%",
          }}
        />

        <div className="p-8 pt-10">
          {/* Logo */}
          <div className="text-center">
            <div
              className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border border-cyan-500/30"
              style={{
                background: "linear-gradient(135deg, rgba(6, 182, 212, 0.1), rgba(139, 92, 246, 0.1))",
                boxShadow: "0 0 30px -5px rgba(6, 182, 212, 0.3)",
              }}
            >
              <Brain size={28} className="text-cyan-400" />
            </div>
            <h1 className="font-display text-2xl font-bold tracking-tight text-white">
              Brain<span className="text-cyan-400">storm</span> AI
            </h1>
            <p className="mt-2 text-sm font-medium text-slate-400">{t("auth.platform")}</p>
            <div className="glass-pill mt-3 inline-flex items-center gap-1.5 rounded-full px-3 py-1">
              <Shield size={10} className="text-emerald-400" />
              <span className="text-[10px] font-mono uppercase tracking-widest text-emerald-400/70">{t("auth.secureConnection")}</span>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="mt-8 space-y-5">
            {errorText && (
              <div
                className="flex items-center gap-2 rounded-lg border border-red-500/30 px-4 py-2.5 text-sm text-red-400"
                style={{ background: "rgba(239, 68, 68, 0.08)" }}
              >
                <span className="h-1.5 w-1.5 rounded-full bg-red-400 animate-pulse" />
                {errorText}
              </div>
            )}

            {/* Email */}
            <div>
              <label htmlFor="email" className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-400">
                <Eye size={11} />
                {t("auth.email")}
              </label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-lg border border-slate-700/50 bg-slate-900/50 px-4 py-3 text-sm text-white placeholder-slate-500 transition-all focus:border-cyan-500/50 focus:outline-none focus:ring-1 focus:ring-cyan-500/20"
                placeholder="you@example.com"
              />
            </div>

            {/* Password */}
            <div>
              <label htmlFor="password" className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-400">
                <Shield size={11} />
                {t("auth.password")}
              </label>
              <input
                id="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-lg border border-slate-700/50 bg-slate-900/50 px-4 py-3 text-sm text-white placeholder-slate-500 transition-all focus:border-cyan-500/50 focus:outline-none focus:ring-1 focus:ring-cyan-500/20"
                placeholder="••••••••"
              />
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="group relative w-full overflow-hidden rounded-lg py-3 text-sm font-semibold tracking-wide text-white transition-all duration-300 disabled:opacity-50"
              style={{
                background: "linear-gradient(135deg, #06B6D4, #8B5CF6)",
                transitionTimingFunction: "var(--ease-out-expo)",
              }}
            >
              <span className="relative z-10">{isSubmitting ? t("auth.connecting") : t("auth.signIn")}</span>
              <div
                className="absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                style={{ background: "linear-gradient(135deg, #0891B2, #7C3AED)" }}
              />
            </button>
          </form>

          {/* Register link */}
          <p className="mt-6 text-center text-sm text-slate-500">
            {t("auth.noAccount")}{" "}
            <a
              href="/register"
              className="font-medium text-cyan-400 transition-colors hover:text-cyan-300 hover:underline"
            >
              {t("auth.createAccount")}
            </a>
          </p>
        </div>

        {/* Bottom accent line */}
        <div
          className="h-0.5 w-full"
          style={{
            background: "linear-gradient(90deg, transparent, #8B5CF6, #06B6D4, transparent)",
          }}
        />
      </div>
    </div>
  );
}
