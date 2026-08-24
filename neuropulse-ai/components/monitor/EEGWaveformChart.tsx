"use client";

import { LineChart, Line, ResponsiveContainer, XAxis, YAxis, Tooltip } from "recharts";
import { EEGSample, EEG_BAND_RANGES } from "@/lib/types";
import { GlowPanel } from "@/components/ui/primitives";
import { useLanguage } from "@/hooks/useLanguageContext";

const BAND_COLORS: Record<string, string> = {
  delta: "#6366F1", // indigo
  theta: "#8B5CF6", // violet
  alpha: "#22D3EE", // cyan
  beta: "#14B8A6", // teal
  gamma: "#F59E0B", // amber
};

export function EEGWaveformChart({ data }: { data: EEGSample[] }) {
  const { t } = useLanguage();
  const chartData = data.map((sample, i) => ({ index: i, ...sample }));

  return (
    <GlowPanel glow="cyan" className="lg:col-span-3">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="font-display text-sm font-semibold text-ink">{t("dash.waveformTitle")}</h2>
          <p className="text-xs text-ink-faint">{t("dash.waveformSub")}</p>
        </div>
        <div className="flex flex-wrap gap-3">
          {Object.entries(BAND_COLORS).map(([band, color]) => (
            <div key={band} className="flex items-center gap-1.5 text-xs text-ink-muted">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
              <span className="capitalize">{band}</span>
              <span className="text-ink-faint">{EEG_BAND_RANGES[band as keyof typeof EEG_BAND_RANGES]}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
            <XAxis dataKey="index" hide />
            <YAxis
              stroke="#5B6478"
              tick={{ fontSize: 11, fill: "#5B6478" }}
              width={36}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "#0F1521",
                border: "1px solid #1E2A3D",
                borderRadius: 8,
                fontSize: 12,
              }}
              labelFormatter={() => ""}
            />
            {Object.entries(BAND_COLORS).map(([band, color]) => (
              <Line
                key={band}
                type="monotone"
                dataKey={band}
                stroke={color}
                strokeWidth={1.75}
                dot={false}
                isAnimationActive={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </GlowPanel>
  );
}
