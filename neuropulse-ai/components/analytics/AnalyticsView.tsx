"use client";

import { useMemo } from "react";
import { generateLongitudinalAll, generateBaselineComparison } from "@/lib/mockData";
import { TrendChart } from "./TrendChart";
import { BaselineComparisonPanel } from "./BaselineComparisonPanel";
import { AnalyticsTipPanel } from "./AnalyticsTipPanel";
import { useLanguage } from "@/hooks/useLanguageContext";

export function AnalyticsView() {
  const { t } = useLanguage();
  const data = useMemo(() => generateLongitudinalAll(), []);
  const comparisonRows = useMemo(() => generateBaselineComparison(data), [data]);

  return (
    <div className="flex flex-col gap-4">
      {/* Header: instrument-panel title + live tag */}
      <div className="rise-in flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-semibold text-ink">{t("an.title")}</h2>
          <p className="text-xs text-ink-faint">{t("an.subtitle")}</p>
        </div>
        <div className="glass-pill flex items-center gap-1.5 rounded-full px-3 py-1">
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full animate-pulse-ring rounded-full bg-cyan-400 opacity-75" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-cyan-400" />
          </span>
          <span className="text-[10px] font-semibold uppercase tracking-wider text-cyan-400">{t("an.liveTag")}</span>
        </div>
      </div>

      <AnalyticsTipPanel data={data} comparisonRows={comparisonRows} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <TrendChart
          index={0}
          title={t("an.chart.burnout")}
          subtitle={t("an.chart.burnoutSub")}
          data={data}
          dataKey="burnoutRisk"
          color="#F59E0B"
          unit="%"
        />
        <TrendChart
          index={1}
          title={t("an.chart.faa")}
          subtitle={t("an.chart.faaSub")}
          data={data}
          dataKey="faaIndex"
          color="#8B5CF6"
        />
        <TrendChart
          index={2}
          title={t("an.chart.spindle")}
          subtitle={t("an.chart.spindleSub")}
          data={data}
          dataKey="sleepSpindleDensity"
          color="#22D3EE"
          unit="/min"
        />
        <TrendChart
          index={3}
          title={t("an.chart.sws")}
          subtitle={t("an.chart.swsSub")}
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
