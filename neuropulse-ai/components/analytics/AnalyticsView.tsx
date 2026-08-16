"use client";

import { useMemo } from "react";
import { generateLongitudinalAll, generateBaselineComparison } from "@/lib/mockData";
import { TrendChart } from "./TrendChart";
import { BaselineComparisonPanel } from "./BaselineComparisonPanel";
import { AnalyticsTipPanel } from "./AnalyticsTipPanel";

export function AnalyticsView() {
  const data = useMemo(() => generateLongitudinalAll(), []);
  const comparisonRows = useMemo(() => generateBaselineComparison(data), [data]);

  return (
    <div className="flex flex-col gap-4">
      {/* Header: instrument-panel title + live tag */}
      <div className="rise-in flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-semibold text-ink">Longitudinal Brain Analytics</h2>
          <p className="text-xs text-ink-faint">Burnout, depression, and cognitive-decline markers over time</p>
        </div>
        <div className="glass-pill flex items-center gap-1.5 rounded-full px-3 py-1">
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full animate-pulse-ring rounded-full bg-cyan-400 opacity-75" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-cyan-400" />
          </span>
          <span className="text-[10px] font-semibold uppercase tracking-wider text-cyan-400">30-day trend · live</span>
        </div>
      </div>

      <AnalyticsTipPanel data={data} comparisonRows={comparisonRows} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <TrendChart
          index={0}
          title="Burnout & Chronic Fatigue Risk"
          subtitle="Composite risk score, 0–100"
          data={data}
          dataKey="burnoutRisk"
          color="#F59E0B"
          unit="%"
        />
        <TrendChart
          index={1}
          title="Frontal Alpha Asymmetry (FAA)"
          subtitle="Depression-risk indicator"
          data={data}
          dataKey="faaIndex"
          color="#8B5CF6"
        />
        <TrendChart
          index={2}
          title="Sleep Spindle Density"
          subtitle="Spindles/min · early cognitive-decline marker"
          data={data}
          dataKey="sleepSpindleDensity"
          color="#22D3EE"
          unit="/min"
        />
        <TrendChart
          index={3}
          title="Slow-Wave Sleep"
          subtitle="% of total sleep in stage 3/4"
          data={data}
          dataKey="slowWaveSleepPercent"
          color="#14B8A6"
          unit="%"
        />
      </div>

      <BaselineComparisonPanel rows={comparisonRows} />
    </div>
  );
}
