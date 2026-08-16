import { LucideIcon } from "lucide-react";
import clsx from "clsx";
import { GlowPanel } from "@/components/ui/primitives";

type MetricTone = "vital" | "neural" | "risk";

const TONE_CONFIG: Record<MetricTone, {
  text: string;
  bg: string;
  border: string;
  glow: string;
  iconBg: string;
}> = {
  vital: {
    text: "text-cyan-400",
    bg: "bg-cyan-500/10",
    border: "border-cyan-500/20",
    glow: "rgba(6, 182, 212, 0.3)",
    iconBg: "bg-cyan-500/10",
  },
  neural: {
    text: "text-violet-400",
    bg: "bg-violet-500/10",
    border: "border-violet-500/20",
    glow: "rgba(139, 92, 246, 0.3)",
    iconBg: "bg-violet-500/10",
  },
  risk: {
    text: "text-amber-400",
    bg: "bg-amber-500/10",
    border: "border-amber-500/20",
    glow: "rgba(245, 158, 11, 0.3)",
    iconBg: "bg-amber-500/10",
  },
};

export function MetricCard({
  label,
  value,
  unit,
  icon: Icon,
  tone,
  helperText,
}: {
  label: string;
  value: number | string;
  unit?: string;
  icon: LucideIcon;
  tone: MetricTone;
  helperText: string;
}) {
  const cfg = TONE_CONFIG[tone];

  return (
    <div
      className={clsx("flex flex-col gap-3 rounded-2xl border p-5 transition-all hover:scale-[1.02]", cfg.border)}
      style={{
        background: "linear-gradient(135deg, rgba(10, 15, 29, 0.9), rgba(14, 21, 37, 0.8))",
        boxShadow: `0 0 30px -8px ${cfg.glow}`,
      }}
    >
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">{label}</span>
        <div className={clsx("flex h-8 w-8 items-center justify-center rounded-lg", cfg.iconBg)}>
          <Icon size={16} className={cfg.text} />
        </div>
      </div>
      <div className="flex items-baseline gap-1.5">
        <span className={clsx("font-display text-3xl font-bold tracking-tight", cfg.text)}>{value}</span>
        {unit && <span className="text-sm text-slate-500">{unit}</span>}
      </div>
      <p className="text-[11px] text-slate-500">{helperText}</p>
    </div>
  );
}
