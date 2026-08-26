"use client";

import { useMemo } from "react";
import { AreaChart, Area, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import { LongitudinalDataPoint } from "@/lib/types";
import { GlowPanel } from "@/components/ui/primitives";
import { useLanguage } from "@/hooks/useLanguageContext";

/** Format an ISO date (YYYY-MM-DD) as DD/MM for axis ticks. */
const formatTickDate = (iso: string) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}`;
};

/** Pick a tick interval that yields ~4-8 labels for any dataset size. */
const tickIntervalFor = (count: number) =>
  Math.max(0, Math.ceil(count / 7) - 1);

/**
 * Per-metric Y-axis configuration: fixed or dynamic domain plus the tick
 * formatting that matches each metric's scale (percent, signed decimal
 * index, count/min). A null domain means "auto-scale to the data" (the
 * 10%-padded domain computed in the component below).
 */
const Y_AXIS_CONFIG: Record<
  string,
  {
    domain: [number | "auto", number | "auto"] | null;
    format: (v: number) => string;
  }
> = {
  burnoutRisk: { domain: [0, 100], format: (v) => String(Math.round(v)) },
  faaIndex: { domain: ["auto", "auto"], format: (v) => v.toFixed(2) },
  sleepSpindleDensity: { domain: null, format: (v) => v.toFixed(1) },
  slowWaveSleepPercent: { domain: [0, "auto"], format: (v) => `${Math.round(v)}%` },
};

export function TrendChart({
  title,
  subtitle,
  data,
  dataKey,
  color,
  unit,
  index = 0,
  infoKey,
}: {
  title: string;
  subtitle: string;
  data: LongitudinalDataPoint[];
  dataKey: keyof LongitudinalDataPoint;
  color: string;
  unit?: string;
  index?: number;
  /** i18n key for the info-tooltip copy shown beside the title. */
  infoKey?: string;
}) {
  const { t } = useLanguage();
  const gradientId = `gradient-${dataKey}`;

  // Strictly sort incoming points oldest → newest by timestamp so the
  // timeline never jumps, regardless of the order the data arrives in.
  const sortedData = useMemo(
    () =>
      [...data].sort(
        (a, b) => new Date(a.date).valueOf() - new Date(b.date).valueOf()
      ),
    [data]
  );

  const yConfig = Y_AXIS_CONFIG[dataKey] ?? {
    domain: null,
    format: (v: number) => v.toLocaleString(),
  };

  // Y domain: fixed bounds where the metric's scale is known (percent
  // metrics), otherwise auto-scale to the data with 10% headroom so each
  // metric (decimal index, count/min) renders on its own scale.
  const yDomain = useMemo<[number | "auto", number | "auto"]>(() => {
    if (yConfig.domain) return yConfig.domain;
    const values = sortedData
      .map((p) => p[dataKey])
      .filter((v): v is number => typeof v === "number" && Number.isFinite(v));
    if (values.length === 0) return ["auto", "auto"];
    const min = Math.min(...values);
    const max = Math.max(...values);
    if (min === max) {
      const pad = Math.abs(min) * 0.1 || 1;
      return [min - pad, max + pad];
    }
    const pad = (max - min) * 0.1;
    return [min - pad, max + pad];
  }, [sortedData, dataKey, yConfig]);

  const latest = sortedData[sortedData.length - 1];
  const latestValue = latest ? (latest[dataKey] as number) : undefined;
  // Same per-metric formatting as the Y-axis ticks, so the header readout
  // and tooltip always match the axis scale.
  const fmt = yConfig.format;

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
            <AreaChart data={sortedData} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
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
                tickFormatter={formatTickDate}
                interval={tickIntervalFor(sortedData.length)}
                axisLine={{ stroke: "var(--hairline-default)" }}
                tickLine={false}
              />
              <YAxis
                domain={yDomain}
                tick={{ fill: "#9CA3AF", fontSize: 12, fontWeight: 500 }}
                width={45}
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
