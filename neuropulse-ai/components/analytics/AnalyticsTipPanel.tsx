"use client";

import { useEffect, useMemo, useState } from "react";
import { Lightbulb, Loader2, Bot, WifiOff } from "lucide-react";
import clsx from "clsx";
import { LongitudinalDataPoint, BaselineComparison } from "@/lib/types";
import { GlowPanel } from "@/components/ui/primitives";
import { apiFetch } from "@/lib/fetchWithHealth";
import { useLanguage } from "@/hooks/useLanguageContext";

type TipState =
  | { status: "idle"; tip?: string; isEstimate?: boolean; reason?: string }
  | { status: "loading" }
  | { status: "done"; tip: string; isEstimate: boolean; latencyMs: number }
  | { status: "error"; reason: string };

interface AnalyticsTipPayload {
  metrics: Record<string, { current: number; avg30: number; delta: number; improved: boolean }>;
  language: "th" | "en";
}

interface MetricSnapshot {
  current: number;
  avg30: number;
  delta: number;
  improved: boolean;
}

/** Map the analytics view's BaselineComparison rows into a compact,
 * backend-friendly metrics snapshot. Each metric keeps its absolute current
 * and 30-day average plus a signed delta and an `improved` flag (whether the
 * change is clinically favorable). */
function buildMetricsSnapshot(comparisonRows: BaselineComparison[]): Record<string, MetricSnapshot> {
  const camelToSnake: Record<string, string> = {
    "Burnout Risk": "burnout_risk",
    "FAA Index": "faa_index",
    "Sleep Spindle Density": "sleep_spindle_density",
    "Slow-Wave Sleep": "slow_wave_sleep",
  };
  const out: Record<string, { current: number; avg30: number; delta: number; improved: boolean }> = {};
  for (const row of comparisonRows) {
    const key = camelToSnake[row.metricLabel];
    if (!key) continue;
    const delta = Math.round((row.current - row.past30DayAverage) * 100) / 100;
    out[key] = {
      current: row.current,
      avg30: row.past30DayAverage,
      delta,
      improved: row.higherIsBetter ? delta > 0 : delta < 0,
    };
  }
  return out;
}

function readAuthToken(): string | null {
  const rawToken = localStorage.getItem("auth_token");
  if (!rawToken) return null;
  if (typeof rawToken === "string" && rawToken.startsWith("{")) {
    try {
      const parsed = JSON.parse(rawToken);
      return parsed.access_token ?? rawToken;
    } catch {
      return rawToken;
    }
  }
  return rawToken;
}

export function AnalyticsTipPanel({
  data,
  comparisonRows,
}: {
  data: LongitudinalDataPoint[];
  comparisonRows: BaselineComparison[];
}) {
  const { lang, t } = useLanguage();
  const metrics = useMemo(() => buildMetricsSnapshot(comparisonRows), [comparisonRows]);
  const [state, setState] = useState<TipState>({ status: "idle" });

  useEffect(() => {
    const token = readAuthToken();
    if (!token) {
      setState({
        status: "idle",
        tip: t("an.tip.unauth"),
        isEstimate: true,
        reason: "unauth",
      });
      return;
    }
    if (!comparisonRows.length) {
      setState({ status: "idle", tip: t("an.tip.nodata"), isEstimate: true, reason: "nodata" });
      return;
    }

    let cancelled = false;
    setState({ status: "loading" });

    const payload: AnalyticsTipPayload = { metrics, language: lang };
    apiFetch<{ tip: string; used_fallback: boolean; latency_ms: number }>("/api/analytics/tip", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify(payload),
    }).then((res) => {
      if (cancelled) return;
      if (res.ok) {
        setState({
          status: "done",
          tip: res.data.tip,
          isEstimate: res.data.used_fallback,
          latencyMs: res.data.latency_ms || 0,
        });
      } else {
        setState({
          status: "error",
          reason: res.error.detail || res.error.message || `HTTP ${res.error.status ?? "unknown"}`,
        });
      }
    });

    return () => {
      cancelled = true;
    };
    // comparisonRows is globally stable once computed; metrics derives from it.
    // Re-fires only when the rows or the active language change (so the tip
    // regenerates in the language the user is reading).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [comparisonRows, lang]);

  // Fallback tip shown when the backend is reachable but returns an error
  // (e.g. auth token is valid yet the request fails) — keeps the panel useful.
  useEffect(() => {
    if (state.status === "error") {
      // Minimal self-describing estimate derived from the same local data.
      const improving = Object.values(metrics).filter((m) => m.improved).length;
      const headline =
        improving >= Object.keys(metrics).length / 2
          ? t("an.tip.fbImproving")
          : t("an.tip.fbFlat");
      const tail =
        t("an.tip.fbTail");
      setState({ status: "done", tip: `${headline} · ${tail}`, isEstimate: true, latencyMs: 0 });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.status]);

  const isEstimate = state.status === "done" && state.isEstimate;

  // Safe tip text for every possible status — the "error" state has no `tip`
  // field, so it must not be accessed in the render below.
  const displayTip = (() => {
    switch (state.status) {
      case "loading":
        return t("an.tip.loading");
      case "done":
        return state.tip;
      case "error":
        return t("an.tip.error");
      case "idle":
        return state.tip || t("an.tip.error");
    }
    return t("an.tip.error");
  })();

  return (
    <GlowPanel glow={isEstimate ? "amber" : "cyan"} className="relative">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span
            className="flex h-7 w-7 items-center justify-center rounded-lg"
            style={{ background: "rgba(245, 158, 11, 0.12)" }}
          >
            <Lightbulb size={14} className="text-amber-400" />
          </span>
          <h3 className="font-display text-sm font-semibold text-ink">{t("an.tip.title")}</h3>
        </div>

        {state.status === "done" && (
          <span
            className={clsx(
              "flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider",
              isEstimate ? "bg-amber-500/10 text-amber-600" : "bg-cyan-500/10 text-cyan-600"
            )}
            title={isEstimate ? t("an.tip.offlineTitle") : t("an.tip.liveTitle")}
          >
            {isEstimate ? <WifiOff size={12} /> : <Bot size={12} />}
            {isEstimate ? t("an.tip.offline") : t("an.tip.live")}
          </span>
        )}
      </div>

      <div className="text-sm leading-relaxed text-ink">
        {state.status === "loading" ? (
          <span className="flex items-center gap-2 text-ink-faint">
            <Loader2 size={13} className="animate-spin" />
            {t("an.tip.loading")}
          </span>
        ) : (
          displayTip
        )}
      </div>
    </GlowPanel>
  );
}