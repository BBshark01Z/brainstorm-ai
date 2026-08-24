"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useEEGContext } from "@/hooks/useEEGContext";
import { EEGBand, EEG_BAND_RANGES } from "@/lib/types";
import { apiFetch, FetchErrorType } from "@/lib/fetchWithHealth";
import { TrendingUp, Info, ExternalLink, Filter } from "lucide-react";
import { useLanguage } from "@/hooks/useLanguageContext";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface BandAggregate {
  sleep_stage: string;
  subject_id: string | null;
  count: number;
  delta_power_mean: number | null;
  delta_power_std: number | null;
  theta_power_mean: number | null;
  theta_power_std: number | null;
  alpha_power_mean: number | null;
  alpha_power_std: number | null;
  beta_power_mean: number | null;
  beta_power_std: number | null;
  gamma_power_mean: number | null;
  gamma_power_std: number | null;
}

interface MergedAggregate {
  sleep_stage: string;
  count: number;
  delta_power_mean: number | null;
  delta_power_std: number | null;
  theta_power_mean: number | null;
  theta_power_std: number | null;
  alpha_power_mean: number | null;
  alpha_power_std: number | null;
  beta_power_mean: number | null;
  beta_power_std: number | null;
  gamma_power_mean: number | null;
  gamma_power_std: number | null;
}

interface ReferenceCompareResponse {
  dataset_name: string;
  source_url: string;
  filter_applied: string | null;
  aggregates: BandAggregate[];
  total_records: number;
}

interface BandValue {
  band: EEGBand;
  label: string;
  userValue: number;
  referenceMean: number | null;
  referenceStd: number | null;
  unit: string;
}

interface SubjectOption {
  subject_id: string;
  epoch_count: number;
}

interface SubjectMeta {
  subject_id: string;
  age: number;
  sex: string;
  nights: { night: number; lights_off: string }[];
  dataset_name: string;
  source_url: string;
  /** Specific raw PSG filename, e.g. "SC4001E0-PSG.edf" (recording 1). */
  source_file?: string;
  /** Specific hypnogram filename if known, e.g. "SC4001EC-Hypnogram.edf". */
  hypnogram_file?: string;
  cohort_note: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const BAND_LABELS: Record<EEGBand, string> = {
  delta: "Delta",
  theta: "Theta",
  alpha: "Alpha",
  beta: "Beta",
  gamma: "Gamma",
};

const STAGE_KEYS: Record<string, string> = {
  W: "bp.stage.W",
  N1: "bp.stage.N1",
  N2: "bp.stage.N2",
  N3: "bp.stage.N3",
  REM: "bp.stage.REM",
  "All stages": "bp.stage.all",
};

const STAGE_ORDER = ["W", "N1", "N2", "N3", "REM"];

/**
 * Merge multiple per-subject aggregates for the same stage into a single
 * row using the combined-variance formula so the numbers are mathematically
 * correct (not just averaging two standard deviations).
 */
function mergeAggregates(
  rows: BandAggregate[]
): MergedAggregate[] {
  const grouped: Record<string, BandAggregate[]> = {};
  rows.forEach((r) => {
    if (!grouped[r.sleep_stage]) grouped[r.sleep_stage] = [];
    grouped[r.sleep_stage].push(r);
  });

  return STAGE_ORDER.map((stage) => {
    const stageRows = grouped[stage] || [];
    if (stageRows.length === 0) return null;

    // Combined mean = weighted average of means
    const totalN = stageRows.reduce((s, r) => s + r.count, 0);
    const bands: EEGBand[] = ["delta", "theta", "alpha", "beta", "gamma"];

    const merged: MergedAggregate = {
      sleep_stage: stage,
      count: totalN,
      delta_power_mean: null,
      delta_power_std: null,
      theta_power_mean: null,
      theta_power_std: null,
      alpha_power_mean: null,
      alpha_power_std: null,
      beta_power_mean: null,
      beta_power_std: null,
      gamma_power_mean: null,
      gamma_power_std: null,
    };

    for (const band of bands) {
      const meanKey = `${band}_power_mean` as keyof BandAggregate;
      const stdKey = `${band}_power_std` as keyof BandAggregate;
      const mKey = `${band}_power_mean` as keyof MergedAggregate;
      const sKey = `${band}_power_std` as keyof MergedAggregate;

      const means = stageRows.map((r) => r[meanKey] as number);
      const stds = stageRows.map((r) => r[stdKey] as number);
      const counts = stageRows.map((r) => r.count);

      // Combined mean (weighted average)
      let combinedMean: number | null = null;
      if (means.every((m) => m != null)) {
        const weightedSum = means.reduce(
          (s, m, i) => s + (m ?? 0) * (counts[i] ?? 0),
          0
        );
        combinedMean = totalN > 0 ? weightedSum / totalN : null;
      }

      // Combined std via combined variance formula
      let combinedStd: number | null = null;
      if (combinedMean != null && stds.every((s) => s != null)) {
        let combinedVariance = 0;
        for (let i = 0; i < stageRows.length; i++) {
          const ni = counts[i] ?? 0;
          const mi = means[i] ?? 0;
          const si = stds[i] ?? 0;
          // Within-group variance
          combinedVariance += ni * (si ** 2);
          // Between-group variance
          combinedVariance += ni * (mi - combinedMean) ** 2;
        }
        combinedStd = totalN > 1 ? Math.sqrt(combinedVariance / totalN) : 0;
      }

      (merged as unknown as Record<string, number | null>)[mKey] =
        combinedMean != null ? Math.round(combinedMean * 10000) / 10000 : null;
      (merged as unknown as Record<string, number | null>)[sKey] =
        combinedStd != null ? Math.round(combinedStd * 10000) / 10000 : null;
    }

    return merged;
  }).filter(Boolean) as MergedAggregate[];
}

/**
 * Build a display row for each EEG band from the user's latest sample
 * and the reference aggregates.
 *
 * FIX: The original code constructed broken column names like
 * `delta__W_power_mean` by concatenating band + "_" + stage + suffix.
 * The actual JSON keys are flat: `delta_power_mean`, `theta_power_std`, etc.
 * This version reads the keys directly from the aggregate object.
 */
function buildBands(
  userSample: { delta: number; theta: number; alpha: number; beta: number; gamma: number },
  aggregates: MergedAggregate[]
): BandValue[] {
  const keys: EEGBand[] = ["delta", "theta", "alpha", "beta", "gamma"];
  const meanMap: Record<EEGBand, number | null> = {
    delta: null, theta: null, alpha: null, beta: null, gamma: null,
  };
  const stdMap: Record<EEGBand, number | null> = {
    delta: null, theta: null, alpha: null, beta: null, gamma: null,
  };

  aggregates.forEach((agg) => {
    // Direct key access — no string concatenation tricks
    (keys as string[]).forEach((k) => {
      const meanKey = `${k}_power_mean` as keyof MergedAggregate;
      const stdKey = `${k}_power_std` as keyof MergedAggregate;
      if (agg[meanKey] != null) meanMap[k as EEGBand] = agg[meanKey] as number;
      if (agg[stdKey] != null) stdMap[k as EEGBand] = agg[stdKey] as number;
    });
  });

  return keys.map((k) => ({
    band: k,
    label: BAND_LABELS[k],
    userValue: userSample[k],
    referenceMean: meanMap[k],
    referenceStd: stdMap[k],
    unit: EEG_BAND_RANGES[k],
  }));
}

// ---------------------------------------------------------------------------
// Custom hook — shared selector state + fetch logic
// ---------------------------------------------------------------------------

const SLEEP_STAGES = ["All stages", "W", "N1", "N2", "N3", "REM"];
const BOTH_COMBINED = "Both combined";

/**
 * Shared hook for the reference-data selector.
 * Manages sleep-stage / subject state and the fetch that feeds both the
 * right-panel selector and the comparison table.
 *
 * Subject options are fetched from GET /api/reference/subjects on mount
 * (distinct subject_id values in eeg_reference_data) — never hardcoded,
 * so newly imported subjects appear automatically.
 */
export function useReferenceSelector() {
  const { t } = useLanguage();
  const [sleepStage, setSleepStage] = useState("All stages");
  const [subjectId, setSubjectId] = useState(BOTH_COMBINED);
  const [subjects, setSubjects] = useState<SubjectOption[]>([]);
  const [aggregates, setAggregates] = useState<MergedAggregate[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filterApplied, setFilterApplied] = useState<string | null>(null);
  // Genuine per-subject demographic metadata (age / sex / nights) shown in
  // the reference info box once a single subject is selected. Fetched from
  // /api/reference/subject-meta only for the active subject.
  const [subjectMeta, setSubjectMeta] = useState<SubjectMeta | null>(null);

  // Monotonic sequence token so only the LATEST compare request's result
  // is applied. Without this, a slow in-flight response from a previously
  // selected subject can resolve after the current one and overwrite
  // `aggregates` — making the epoch-count number appear to change on
  // repeated clicks of the SAME subject (a stale/raced value).
  const compareSeq = useRef(0);

  // Fetch available subjects once on mount
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const result = await apiFetch<{ subjects: SubjectOption[] }>(
        "/api/reference/subjects",
        {}
      );
      if (cancelled) return;
      if (result.ok) {
        setSubjects(result.data.subjects);
      }
      // On failure the selector just shows "Both combined" — the compare
      // fetch will surface the backend error in the table itself.
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // If the current selection disappears from the DB (e.g. re-import),
  // fall back to "Both combined" so we never query a stale subject.
  useEffect(() => {
    if (
      subjects.length > 0 &&
      subjectId !== BOTH_COMBINED &&
      !subjects.some((s) => s.subject_id === subjectId)
    ) {
      setSubjectId(BOTH_COMBINED);
    }
  }, [subjects, subjectId]);

  const fetchReference = useCallback(async () => {
    const seq = ++compareSeq.current;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (sleepStage !== "All stages") {
        params.set("sleep_stage", sleepStage);
      }
      if (subjectId !== BOTH_COMBINED) {
        params.set("subject_id", subjectId);
      }
      const query = params.toString();
      const url = query ? `/api/reference/compare?${query}` : "/api/reference/compare";

      const result = await apiFetch<ReferenceCompareResponse>(url, {});
      // A newer selection superseded this request — drop its result so we
      // never render a stale/mismatched epoch count for the visible subject.
      if (seq !== compareSeq.current) return;
      if (!result.ok) {
        const err = result.error;
        if (err.type === FetchErrorType.NETWORK) {
          setError(t("bp.error.network"));
        } else {
          setError(err.detail || t("bp.error.generic"));
        }
        setAggregates([]);
        return;
      }
      setFilterApplied(result.data.filter_applied);

      // If "Both combined" and multiple subjects returned, merge by stage
      let displayData: MergedAggregate[];
      if (subjectId === BOTH_COMBINED && sleepStage === "All stages") {
        displayData = mergeAggregates(result.data.aggregates);
      } else {
        // Single subject or single stage: one row per stage
        displayData = result.data.aggregates.map((a) => ({
          sleep_stage: a.sleep_stage,
          count: a.count,
          delta_power_mean: a.delta_power_mean,
          delta_power_std: a.delta_power_std,
          theta_power_mean: a.theta_power_mean,
          theta_power_std: a.theta_power_std,
          alpha_power_mean: a.alpha_power_mean,
          alpha_power_std: a.alpha_power_std,
          beta_power_mean: a.beta_power_mean,
          beta_power_std: a.beta_power_std,
          gamma_power_mean: a.gamma_power_mean,
          gamma_power_std: a.gamma_power_std,
        }));
      }
      setAggregates(displayData);
    } catch (err) {
      if (seq !== compareSeq.current) return;
      setError(err instanceof Error ? err.message : t("bp.error.unknown"));
      setAggregates([]);
    } finally {
      if (seq === compareSeq.current) setLoading(false);
    }
  }, [sleepStage, subjectId, t]);

  // Initial load on mount
  useEffect(() => {
    fetchReference();
  }, [fetchReference]);

  // The currently selected single subject, when one is chosen. This is the
  // single source of truth for the epoch count shown for a selected subject,
  // read directly from the deterministic /api/reference/subjects epoch_count.
  const selectedSubject = useMemo(() => {
    if (subjectId === BOTH_COMBINED) return null;
    return subjects.find((s) => s.subject_id === subjectId) ?? null;
  }, [subjects, subjectId]);

  // Fetch genuine demographic metadata for the selected subject. Cleared when
  // no single subject is selected (e.g. "Both combined") so a stale info box
  // never lingers. Errors are silent: the info box simply won't show — we
  // never want a metadata fetch to block the comparison table.
  const selectedId = selectedSubject?.subject_id ?? null;
  useEffect(() => {
    let cancelled = false;
    if (!selectedId) {
      setSubjectMeta(null);
      return;
    }
    (async () => {
      const result = await apiFetch<SubjectMeta>(
        `/api/reference/subject-meta?subject_id=${encodeURIComponent(selectedId)}`,
        {}
      );
      if (cancelled) return;
      if (result.ok) setSubjectMeta(result.data);
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedId]);

  return {
    sleepStage, setSleepStage,
    subjectId, setSubjectId,
    subjects,
    selectedSubject,
    subjectMeta,
    aggregates, loading, error, filterApplied,
    fetchReference,
  };
}

// ---------------------------------------------------------------------------
// ReferenceSelector — stage chips + subject cards
// ---------------------------------------------------------------------------

/**
 * Standalone sleep-stage / subject selector controls.
 *
 * Used inside BrainprintView's right panel so the user can filter the
 * reference comparison without the controls floating above the table.
 *
 * Subjects are rendered as clickable cards (ID + epoch count, fetched
 * live from the backend) and sleep stages as chips — both reuse the
 * app's existing pill/card styling (see StatusPill / primitives.tsx).
 * Selecting anything immediately re-runs the comparison.
 */
export function ReferenceSelector({
  sleepStage, setSleepStage,
  subjectId, setSubjectId,
  subjects,
  loading, fetchReference,
}: {
  sleepStage: string;
  setSleepStage: (v: string) => void;
  subjectId: string;
  setSubjectId: (v: string) => void;
  subjects: SubjectOption[];
  loading: boolean;
  fetchReference: () => void;
}) {
  const { t } = useLanguage();
  // The active subject's epoch count — revealed only once that card is the
  // selected subject. Before any subject is selected (default "Both combined"),
  // no epoch-length value is rendered at all (see Task I step 3).
  const activeSubject = subjects.find((s) => s.subject_id === subjectId) ?? null;

  // Setting state is enough: the hook's useEffect re-runs fetchReference
  // whenever sleepStage or subjectId changes.
  const chipBase =
    "rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors cursor-pointer select-none";
  const chipIdle =
    "border-base-border bg-base-surface text-ink-muted hover:border-neural/40 hover:text-ink";
  const chipActive =
    "border-neural/50 bg-neural/10 text-neural";

  return (
    <div className="rounded-lg border border-base-border bg-base-overlay/50 p-3">
      <p className="mb-2 text-xs font-medium text-ink-muted">
        {t("bp.ref.filter")}
      </p>

      {/* Sleep stage chips */}
      <div className="mb-3">
        <p className="mb-1.5 text-[10px] font-medium text-ink-muted">
          {t("bp.ref.sleepStage")}
        </p>
        <div className="flex flex-wrap gap-1.5">
          {SLEEP_STAGES.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setSleepStage(s)}
              className={`${chipBase} ${sleepStage === s ? chipActive : chipIdle}`}
            >
              {STAGE_KEYS[s] ? t(STAGE_KEYS[s]) : s}
            </button>
          ))}
        </div>
      </div>

      {/* Subject cards */}
      <div>
        <p className="mb-1.5 text-[10px] font-medium text-ink-muted">
          {t("bp.ref.subject")}
        </p>
        <div className="grid grid-cols-2 gap-1.5">
          <button
            type="button"
            onClick={() => setSubjectId(BOTH_COMBINED)}
            className={`${chipBase} flex flex-col items-start gap-0.5 !px-3 !py-2 ${
              subjectId === BOTH_COMBINED ? chipActive : chipIdle
            }`}
          >
            <span className="text-xs font-medium">{t("bp.ref.both")}</span>
          </button>
          {subjects.map((s) => (
            <button
              key={s.subject_id}
              type="button"
              onClick={() => setSubjectId(s.subject_id)}
              className={`${chipBase} flex flex-col items-start gap-0.5 !px-3 !py-2 ${
                subjectId === s.subject_id ? chipActive : chipIdle
              }`}
            >
              <span className="text-xs font-medium">{s.subject_id}</span>
              {subjectId === s.subject_id && activeSubject && (
                <span className="text-[10px] opacity-70">
                  {t("bp.ref.epochs", { count: activeSubject.epoch_count.toLocaleString() })}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      <button
        onClick={fetchReference}
        disabled={loading}
        className="mt-3 flex items-center gap-1.5 rounded-md bg-neural/10 px-3 py-1.5 text-xs font-medium text-neural transition-colors hover:bg-neural/20 disabled:opacity-50"
      >
        <Filter size={12} />
        {loading ? t("bp.ref.loading") : t("bp.ref.compare")}
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// SubjectInfoBox — reference subject details (shown once a subject is picked)
// ---------------------------------------------------------------------------

/**
 * Info box describing a selected reference subject.
 *
 * Only genuinely-available fields are shown:
 * - subject id + epoch count (stable DB value, from Task I)
 * - age / sex + recorded nights with lights-off times (from MNE Sleep
 *   Cassette metadata, /api/reference/subject-meta)
 * - dataset attribution + a factual cohort note.
 *
 * No "health risk" field is shown: the Sleep Cassette cohort were healthy
 * volunteers not selected for any disorder, so no such data exists.
 */
function SubjectInfoBox({
  selectedSubject,
  subjectMeta,
}: {
  selectedSubject: { subject_id: string; epoch_count: number };
  subjectMeta: SubjectMeta | null;
}) {
  const { t } = useLanguage();
  return (
    <div className="rounded-lg border border-base-border bg-base-overlay/50 p-3">
      <div className="mb-2 flex items-center gap-2">
        <Info size={14} className="shrink-0 text-neural" />
        <span className="text-[11px] font-semibold uppercase tracking-wide text-ink-muted">
          {t("bp.ref.boxTitle")}
        </span>
      </div>

      <div className="space-y-1">
        <div className="flex items-baseline justify-between">
          <span className="text-[10px] text-ink-faint">{t("bp.ref.subject")}</span>
          <span className="font-mono text-xs font-medium text-ink">
            {selectedSubject.subject_id}
          </span>
        </div>
        <div className="flex items-baseline justify-between">
          <span className="text-[10px] text-ink-faint">{t("bp.ref.epochsRow")}</span>
          <span className="font-mono text-xs tabular-nums text-ink">
            {selectedSubject.epoch_count.toLocaleString()}
          </span>
        </div>

        {/* Only render demographic rows when genuinely available. */}
        {subjectMeta && (
          <>
            {subjectMeta.age > 0 && (
              <div className="flex items-baseline justify-between">
                <span className="text-[10px] text-ink-faint">{t("bp.ref.age")}</span>
                <span className="text-xs text-ink">{t("bp.ref.yrs", { count: subjectMeta.age })}</span>
              </div>
            )}
            {subjectMeta.sex && (
              <div className="flex items-baseline justify-between">
                <span className="text-[10px] text-ink-faint">{t("bp.ref.sex")}</span>
                <span className="text-xs text-ink">{subjectMeta.sex}</span>
              </div>
            )}
            {subjectMeta.nights.length > 0 && (
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-[10px] text-ink-faint">{t("bp.ref.recordings")}</span>
                <span className="text-right text-xs text-ink">
                  {subjectMeta.nights.length}{" "}
                  {t(subjectMeta.nights.length === 1 ? "bp.ref.night" : "bp.ref.nights")}
                  <span className="block text-[10px] text-ink-faint">
                    {t("bp.ref.lightsOff", { times: subjectMeta.nights.map((n) => n.lights_off).join(" / ") })}
                  </span>
                </span>
              </div>
            )}
          </>
        )}
      </div>

      {/* Dataset attribution + per-subject source file links */}
      <div className="mt-3 border-t border-base-border/60 pt-2">
        <p className="text-[10px] text-ink-faint">
          {(subjectMeta?.dataset_name ?? "Sleep-EDF Database Expanded") +
            t("bp.ref.datasetSuffix")}
        </p>
        {/* Direct link to this subject's actual raw PSG recording. */}
        {subjectMeta?.source_url && (
          <a
            href={subjectMeta.source_url}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-1 inline-flex items-center gap-1 text-[10px] text-neural underline underline-offset-2 transition-colors hover:text-neural/80"
          >
            {subjectMeta.source_file ?? subjectMeta.subject_id} <ExternalLink size={10} />
          </a>
        )}
        {/* Direct link to this subject's hypnogram file, when known. */}
        {subjectMeta?.hypnogram_file && (
          <a
            href={subjectMeta.source_url.replace(
              subjectMeta.source_file ?? "",
              subjectMeta.hypnogram_file
            )}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-0.5 block inline-flex items-center gap-1 text-[10px] text-neural underline underline-offset-2 transition-colors hover:text-neural/80"
          >
            {subjectMeta.hypnogram_file} <ExternalLink size={10} />
          </a>
        )}
      </div>

      {/* Factual cohort note — no fabricated health risk is added. */}
      {subjectMeta?.cohort_note && (
        <p className="mt-2 border-t border-base-border/60 pt-2 text-[10px] leading-relaxed text-ink-faint">
          {subjectMeta.cohort_note}
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// BandPowerComparison — pure display component
// ---------------------------------------------------------------------------

interface BandPowerComparisonProps {
  aggregates: MergedAggregate[];
  loading: boolean;
  error: string | null;
  filterApplied: string | null;
  /**
   * The selected single subject's exact epoch count from the DB
   * (/api/reference/subjects), plus its id. Null when no single subject is
   * selected / "Both combined" — in that case no epoch-length value is shown
   * (Task I step 3), because a summed "Both combined" total is misleading.
   */
  selectedSubject: { subject_id: string; epoch_count: number } | null;
  /** Genuine demographic metadata for the selected subject (age/sex/nights). */
  subjectMeta: SubjectMeta | null;
}

/**
 * Side-by-side comparison of the user's current EEG band power values
 * against reference dataset aggregates (Sleep-EDF).
 *
 * Displays:
 * - User value vs reference mean ± std per band
 * - Whether the user's value falls within 1 std deviation of the reference mean
 * - Reference source attribution (dataset name, record count, PhysioNet link)
 *
 * Receives selector state from BrainprintView — does NOT manage its own
 * selector state. The selector UI lives in the right panel.
 *
 * Integrated into BrainprintView — does NOT replace or modify any existing
 * brainprint enrollment / verification / profile list functionality.
 */
export function BandPowerComparison({
  aggregates,
  loading,
  error,
  filterApplied,
  selectedSubject,
  subjectMeta,
}: BandPowerComparisonProps) {
  const { latestSample } = useEEGContext();
  const { t } = useLanguage();

  // Need at least one sample to show anything
  if (!latestSample) {
    return (
      <div className="panel flex flex-col gap-5">
        <div className="flex items-center gap-2">
          <TrendingUp size={16} className="text-neural" />
          <h3 className="text-sm font-display font-semibold text-ink">
            {t("bp.band.title")}
          </h3>
        </div>
        <div className="flex flex-col items-center justify-center gap-2 p-8 text-center text-ink-faint">
          <TrendingUp size={20} className="opacity-40" />
          <p className="text-sm">{t("bp.band.connectHint")}</p>
        </div>
      </div>
    );
  }

  const bands = aggregates.length > 0 ? buildBands(latestSample, aggregates) : [];

  return (
    <div className="panel flex flex-col gap-5">
      {/* Title */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <TrendingUp size={16} className="text-neural" />
          <h3 className="text-sm font-display font-semibold text-ink">
            {t("bp.band.title")}
          </h3>
        </div>
        {filterApplied && (
          <span className="text-[10px] text-ink-faint">
            {t("bp.band.filter")}{filterApplied}
          </span>
        )}
      </div>

      {/* Reference subject info box — only once a single subject is selected */}
      {selectedSubject && (
        <SubjectInfoBox
          selectedSubject={selectedSubject}
          subjectMeta={subjectMeta}
        />
      )}

      {loading && aggregates.length === 0 && (
        <div className="flex flex-col items-center justify-center gap-2 p-8 text-center text-ink-faint">
          <p className="text-sm">{t("bp.band.loading")}</p>
        </div>
      )}

      {error && (
        <div className="flex flex-col items-center justify-center gap-2 p-8 text-center text-ink-faint">
          <Info size={20} className="opacity-40" />
          <p className="text-sm">{error}</p>
        </div>
      )}

      {!loading && !error && aggregates.length === 0 && (
        <div className="flex flex-col items-center justify-center gap-2 p-8 text-center text-ink-faint">
          <Info size={20} className="opacity-40" />
          <p className="text-sm">{t("bp.band.noMatch")}</p>
        </div>
      )}

      {/* Comparison table */}
      {!loading && bands.length > 0 && (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-base-border text-ink-muted">
                  <th className="pb-2 pr-4 font-medium">{t("bp.band.colBand")}</th>
                  <th className="pb-2 pr-4 text-right font-medium">{t("bp.band.colYour")}</th>
                  <th className="pb-2 pr-4 text-right font-medium">{t("bp.band.colRef")}</th>
                  <th className="pb-2 font-medium">{t("bp.band.colMatch")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-base-border/50">
                {bands.map((b) => {
                  const inRange =
                    b.referenceMean != null && b.referenceStd != null
                      ? b.userValue >= b.referenceMean - b.referenceStd &&
                        b.userValue <= b.referenceMean + b.referenceStd
                      : null;

                  return (
                    <tr key={b.band} className="group transition-colors hover:bg-base-overlay">
                      <td className="pr-4 py-2.5">
                        <div className="flex flex-col">
                          <span className="font-medium text-ink">{b.label}</span>
                          <span className="text-[10px] text-ink-faint">{b.unit}</span>
                        </div>
                      </td>
                      <td className="pr-4 py-2.5 text-right font-mono tabular-nums text-neural">
                        {b.userValue.toFixed(4)}
                      </td>
                      <td className="pr-4 py-2.5 text-right font-mono tabular-nums text-ink-muted">
                        {b.referenceMean != null && b.referenceStd != null
                          ? `${b.referenceMean.toFixed(4)} ± ${b.referenceStd.toFixed(4)}`
                          : "—"}
                      </td>
                      <td className="py-2.5">
                        {inRange === null ? (
                          <span className="text-ink-faint">—</span>
                        ) : inRange ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-vital/10 px-2 py-0.5 text-[10px] font-medium text-vital">
                            {t("bp.band.inRange")}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-risk-amber/10 px-2 py-0.5 text-[10px] font-medium text-risk-amber">
                            {t("bp.band.outside")}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Reference source attribution */}
          {aggregates.length > 0 && (
            <div className="rounded-lg border border-base-border bg-base-overlay/50 p-3">
              <div className="flex items-start gap-2">
                <Info size={14} className="mt-0.5 shrink-0 text-ink-faint" />
                <div className="flex-1">
                  <p className="text-[11px] font-medium text-ink-muted">
                    {t("bp.band.reference")}
                  </p>
                  {/* Epoch-length value only shown once a single real subject is
                      selected, using its exact deterministic DB epoch_count —
                      not a re-summed aggregate. Hidden under "Both combined". */}
                  {selectedSubject ? (
                    <p className="mt-.5 text-[10px] text-ink-faint">
                      {t("bp.band.epochCount", {
                        id: selectedSubject.subject_id,
                        count: selectedSubject.epoch_count.toLocaleString(),
                        filter: filterApplied ? ` (${filterApplied})` : "",
                      })}
                    </p>
                  ) : (
                    <p className="mt-.5 text-[10px] text-ink-faint">
                      {t("bp.band.selectSubject")}
                    </p>
                  )}
                  <a
                    href={
                      subjectMeta?.source_url ??
                      "https://physionet.org/content/sleep-edfx/1.0.0/"
                    }
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-1 inline-flex items-center gap-1 text-[10px] text-neural underline underline-offset-2 transition-colors hover:text-neural/80"
                  >
                    {subjectMeta?.source_file
                      ? t("bp.ref.fileOnPhysionet", { file: subjectMeta.source_file })
                      : t("bp.ref.viewPhysionet")}
                    <ExternalLink size={10} />
                  </a>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
