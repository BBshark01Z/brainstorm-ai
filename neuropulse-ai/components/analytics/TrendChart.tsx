"use client";

import { AreaChart, Area, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import { LongitudinalDataPoint } from "@/lib/types";
import { GlowPanel } from "@/components/ui/primitives";
import { useLanguage } from "@/hooks/useLanguageContext";

type YDomain = [number | "auto", number | "auto"];

export function TrendChart({
  title,
  subtitle,
  data,
  dataKey,
  color,
  unit,
  index = 0,
  domain,
  infoKey,
}: {
  title: string;
  subtitle: string;
  data: LongitudinalDataPoint[];
  dataKey: keyof LongitudinalDataPoint;
  color: string;
  unit?: string;
  index?: number;
  /** Y-axis domain, set per metric (e.g. [0,100] for %, ['auto','auto'] for signed FAA). */
  domain?: YDomain;
  /** i18n key for the info-tooltip copy shown beside the title. */
  infoKey?: string;
}) {
  const { t } = useLanguage();
  const gradientId = `gradient-${dataKey}`;
  const latest = data[data.length - 1];
  const latestValue = latest ? (latest[dataKey] as number) : undefined;
  // Signed metrics (FAA) read better with one decimal; whole-number metrics
  // (percent, spindles/min) stay as-is.
  const isDecimal = dataKey === "faaIndex";
  const fmt = (v: number) => (isDecimal ? v.toFixed(1) : v.toLocaleString());

  return (
    <div className="rise-in" style={{ animationDelay: `${index * 70}ms` }}>
      <GlowPanel className="h-full transition-all duration-300 hover:shadow-glow-cyan">
        {/* Header: colored accent dot + latest-value readout */}
        <div className="mb-3 flex items-start justify-between gap-2">
          <div>
            <div className="mb-1 flex items-center gap-1.5">
              <span
                className="h-1.5 w-1.5 shrink-0 rounded-full"
                style={{ background: color, boxShadow: `0 0 8px ${color}` }}
              />
              <h3 className="font-display text-sm font-semibold text-ink">{title}</h3>
              {infoKey && (
                <span className="group relative inline-flex" tabIndex={0}>
                  <svg
                    viewBox="0 0 20 20"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    className="h-3.5 w-3.5 cursor-help text-ink-faint transition-colors group-hover:text-cyan-400 group-focus:text-cyan-400"
                    aria-label={t(infoKey)}
                  >
                    <circle cx="10" cy="10" r="8.25" />
                    <path d="M10 9v4.5" strokeLinecap="round" />
                    <circle cx="10" cy="6.25" r="0.75" fill="currentColor" stroke="none" />
                  </svg>
                  <span
                    role="tooltip"
                    className="pointer-events-none absolute left-1/2 top-full z-20 mt-1.5 w-52 -translate-x-1/2 rounded-lg border border-base-border bg-base-overlay/95 px-3 py-2 text-[11px] leading-relaxed text-ink opacity-0 shadow-glow-cyan backdrop-blur-md transition-opacity duration-150 group-hover:opacity-100 group-focus:opacity-100"
                  >
                    {t(infoKey)}
                  </span>
                </span>
              )}
            </div>
            <p className="text-xs text-ink-faint">{subtitle}</p>
          </div>
          {latestValue !== undefined && (
            <div className="shrink-0 rounded-lg border border-base-border bg-base-overlay/40 px-2 py-1 text-right">
              <span className="block text-[10px] uppercase tracking-wider text-ink-faint">{t("an.latest")}</span>
              <span className="font-mono text-sm font-semibold" style={{ color }}>
                {fmt(latestValue)}
                {unit ?? ""}
              </span>
            </div>
          )}
        </div>
        <div className="h-48 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
              <defs>
                <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={color} stopOpacity={0.35} />
                  <stop offset="95%" stopColor={color} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="var(--hairline-default)" strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 10, fill: "#5B6478" }}
                tickFormatter={(d: string) => d.slice(5)}
                minTickGap={24}
                axisLine={{ stroke: "var(--hairline-default)" }}
                tickLine={false}
              />
              <YAxis
                domain={domain ?? ["auto", "auto"]}
                tick={{ fontSize: 10, fill: "#5B6478" }}
                width={32}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v: number) => fmt(v)}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "var(--surface-glass-heavy)",
                  border: "1px solid var(--hairline-default)",
                  backdropFilter: "blur(12px)",
                  borderRadius: 10,
                  fontSize: 12,
                  boxShadow: `0 0 20px -8px ${color}`,
                }}
                labelStyle={{ color: "#8B96A8" }}
                itemStyle={{ color: "#E6EDF7" }}
                formatter={(value: number) => [`${fmt(value)}${unit ?? ""}`, title]}
              />
              <Area
                type="monotone"
                dataKey={dataKey}
                stroke={color}
                strokeWidth={2}
                fill={`url(#${gradientId})`}
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </GlowPanel>
    </div>
  );
}
