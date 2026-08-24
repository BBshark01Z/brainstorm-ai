import { ArrowUp, ArrowDown, Minus } from "lucide-react";
import clsx from "clsx";
import { BaselineComparison } from "@/lib/types";
import { GlowPanel } from "@/components/ui/primitives";
import { useLanguage } from "@/hooks/useLanguageContext";

// metricLabel (wire value from mockData) → i18n key. Unknown labels fall
// back to the raw English string.
const METRIC_LABEL_KEYS: Record<string, string> = {
  "Burnout Risk": "an.metric.burnout",
  "FAA Index": "an.metric.faa",
  "Sleep Spindle Density": "an.metric.spindle",
  "Slow-Wave Sleep": "an.metric.sws",
};

export function BaselineComparisonPanel({ rows }: { rows: BaselineComparison[] }) {
  const { t } = useLanguage();
  const improvedCount = rows.filter(
    (row) => (row.higherIsBetter ? row.current > row.past30DayAverage : row.current < row.past30DayAverage)
  ).length;

  return (
    <div className="rise-in" style={{ animationDelay: "280ms" }}>
      <GlowPanel className="transition-shadow duration-300 hover:shadow-glow-purple">
        <div className="mb-1 flex items-start justify-between gap-3">
          <div>
            <h3 className="font-display text-sm font-semibold text-ink">
              {t("an.baseline.title")}
            </h3>
            <p className="text-xs text-ink-faint">{t("an.baseline.sub")}</p>
          </div>
          <div className="glass-pill shrink-0 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-neon">
            {t("an.baseline.improving", { count: improvedCount, total: rows.length })}
          </div>
        </div>

        <div className="mt-3 flex flex-col divide-y divide-base-border">
          {rows.map((row) => {
            const delta = Math.round((row.current - row.past30DayAverage) * 100) / 100;
            const improved = row.higherIsBetter ? delta > 0 : delta < 0;
            const unchanged = delta === 0;

            return (
              <div key={row.metricLabel} className="flex items-center justify-between py-3 transition-colors hover:bg-base-overlay/20">
                <div>
                  <p className="text-sm text-ink">
                    {METRIC_LABEL_KEYS[row.metricLabel] ? t(METRIC_LABEL_KEYS[row.metricLabel]) : row.metricLabel}
                  </p>
                  <p className="text-xs text-ink-faint">
                    {t("an.baseline.avg30", { value: row.past30DayAverage, unit: row.unit })}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-display text-sm font-semibold text-ink">
                    {row.current}
                    {row.unit}
                  </p>
                  <div
                    className={clsx(
                      "glass-pill mt-1 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px]",
                      unchanged ? "text-ink-faint" : improved ? "text-vital" : "text-risk-red"
                    )}
                  >
                    {unchanged ? <Minus size={11} /> : delta > 0 ? <ArrowUp size={11} /> : <ArrowDown size={11} />}
                    {Math.abs(delta)}
                    {row.unit}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </GlowPanel>
    </div>
  );
}
