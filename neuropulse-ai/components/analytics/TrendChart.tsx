"use client";

import { AreaChart, Area, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import { LongitudinalDataPoint } from "@/lib/types";
import { GlowPanel } from "@/components/ui/primitives";

export function TrendChart({
  title,
  subtitle,
  data,
  dataKey,
  color,
  unit,
  index = 0,
}: {
  title: string;
  subtitle: string;
  data: LongitudinalDataPoint[];
  dataKey: keyof LongitudinalDataPoint;
  color: string;
  unit?: string;
  index?: number;
}) {
  const gradientId = `gradient-${dataKey}`;
  const latest = data[data.length - 1];
  const latestValue = latest ? (latest[dataKey] as number) : undefined;

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
            </div>
            <p className="text-xs text-ink-faint">{subtitle}</p>
          </div>
          {latestValue !== undefined && (
            <div className="shrink-0 rounded-lg border border-base-border bg-base-overlay/40 px-2 py-1 text-right">
              <span className="block text-[10px] uppercase tracking-wider text-ink-faint">Latest</span>
              <span className="font-mono text-sm font-semibold" style={{ color }}>
                {latestValue.toLocaleString()}
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
                tick={{ fontSize: 10, fill: "#5B6478" }}
                width={32}
                axisLine={false}
                tickLine={false}
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
                formatter={(value: number) => [`${value}${unit ?? ""}`, title]}
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
