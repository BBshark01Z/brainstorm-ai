import { ReactNode } from "react";
import clsx from "clsx";
import { InsightSeverity } from "@/lib/types";

// ---------------------------------------------------------------------------
// Small shared visual primitives used across monitor / brainprint / analytics
// / ai components, kept in one file since each is only a few lines.
// ---------------------------------------------------------------------------

/** Colored dot + label used for severity (info/warning/critical) contexts. */
export function SeverityBadge({ severity }: { severity: InsightSeverity }) {
  const styles: Record<InsightSeverity, string> = {
    info: "bg-vital/10 text-vital border-vital/30",
    warning: "bg-risk-amber/10 text-risk-amber border-risk-amber/30",
    critical: "bg-risk-red/10 text-risk-red border-risk-red/30",
  };
  const labels: Record<InsightSeverity, string> = {
    info: "Info",
    warning: "Watch",
    critical: "Critical",
  };
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium",
        styles[severity]
      )}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {labels[severity]}
    </span>
  );
}

/** Generic pill for header/status contexts (connected, verified, etc). */
export function StatusPill({
  icon,
  label,
  tone = "neutral",
}: {
  icon: ReactNode;
  label: string;
  tone?: "neutral" | "vital" | "neural" | "risk";
}) {
  const toneStyles: Record<string, string> = {
    neutral: "border-base-border text-ink-muted",
    vital: "border-vital/30 text-vital bg-vital/5",
    neural: "border-neural/30 text-neural bg-neural/5",
    risk: "border-risk-red/30 text-risk-red bg-risk-red/5",
  };
  return (
    <div
      className={clsx(
        "flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium",
        toneStyles[tone]
      )}
    >
      {icon}
      <span className="hidden sm:inline">{label}</span>
    </div>
  );
}

/** Base card surface with optional accent glow, used as the app-wide panel shell. */
export function GlowPanel({
  children,
  className,
  glow,
}: {
  children: ReactNode;
  className?: string;
  glow?: "cyan" | "purple" | "red" | "amber";
}) {
  const glowShadow: Record<string, string> = {
    cyan: "shadow-glow-cyan",
    purple: "shadow-glow-purple",
    red: "shadow-glow-red",
    amber: "shadow-glow-amber",
  };
  return (
    <div
      className={clsx(
        "panel p-5",
        glow && glowShadow[glow],
        className
      )}
    >
      {children}
    </div>
  );
}
