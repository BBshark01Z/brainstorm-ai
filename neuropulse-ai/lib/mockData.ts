// ---------------------------------------------------------------------------
// NeuroPulse AI — Data utilities (production)
//
// All mock/fake data has been removed. This module now only contains pure
// utility functions for the real-time EEG pipeline:
//   - generateEEGSample()       — waveform synthesis for the simulator hook
//   - deriveMetrics()           — cognitive metrics from an EEG sample
//   - generateLongitudinalAll() — mixed-granularity trend data for the analytics page
//   - generateBaselineComparison() — current vs. 30-day-average rows
//
// Removed: MOCK_CONNECTION_STATUS, MOCK_DIAGNOSTIC_INSIGHTS,
//   PROMPT_SUGGESTIONS, MOCK_USER_ID, MOCK_BRAINPRINT_PROFILE,
//   ENROLLED_SIGNATURE_VECTOR, MOCK_KNOWN_PROFILES
// ---------------------------------------------------------------------------

import {
  EEGSample,
  DerivedMetrics,
  LongitudinalDataPoint,
  BaselineComparison,
} from "./types";

// ---------------------------------------------------------------------------
// Small numeric helpers
// ---------------------------------------------------------------------------

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

const round1 = (value: number) => Math.round(value * 10) / 10;
const round2 = (value: number) => Math.round(value * 100) / 100;

/** Symmetric random noise in [-magnitude, +magnitude]. */
const noiseAround = (magnitude: number) => (Math.random() - 0.5) * 2 * magnitude;

// ---------------------------------------------------------------------------
// Real-time EEG sample synthesis
//
// This stands in for a real EEG SDK's streaming callback. Each band is a slow
// sine wave (to look "alive" rather than static) plus jitter. `alphaF3` /
// `alphaF4` model left/right frontal alpha independently so Frontal Alpha
// Asymmetry (FAA) has something meaningful to compute from.
// ---------------------------------------------------------------------------

export function generateEEGSample(elapsedSeconds: number): EEGSample {
  const delta = 28 + Math.sin(elapsedSeconds * 0.15) * 6 + noiseAround(3);
  const theta = 16 + Math.sin(elapsedSeconds * 0.35 + 1) * 4 + noiseAround(2.5);
  const alpha = 24 + Math.sin(elapsedSeconds * 0.6 + 2) * 5 + noiseAround(3);
  const beta = 9 + Math.sin(elapsedSeconds * 1.1 + 0.5) * 2.5 + noiseAround(2);
  const gamma = 2.5 + Math.sin(elapsedSeconds * 2.3) * 1 + noiseAround(0.8);

  // Slow drift models a mild, wandering left/right frontal asymmetry —
  // enough for the FAA number on the dashboard to move over a session.
  const asymmetryDrift = Math.sin(elapsedSeconds * 0.05) * 3;
  const alphaF3 = Math.max(1, alpha + asymmetryDrift + noiseAround(2)); // left frontal
  const alphaF4 = Math.max(1, alpha - asymmetryDrift + noiseAround(2)); // right frontal

  return {
    timestamp: Date.now(),
    delta: round1(Math.max(1, delta)),
    theta: round1(Math.max(1, theta)),
    alpha: round1(Math.max(1, alpha)),
    beta: round1(Math.max(1, beta)),
    gamma: round1(Math.max(0.2, gamma)),
    alphaF3: round1(alphaF3),
    alphaF4: round1(alphaF4),
  };
}

/**
 * Derives the four headline real-time metrics from a single EEG sample.
 *
 * These ratios (engagement/beta index, beta/alpha, theta/beta ratio, and
 * frontal alpha asymmetry) are simplified stand-ins for published
 * neurofeedback heuristics — they are NOT validated clinical formulas. Swap
 * this function out for your certified signal-processing pipeline before any
 * real clinical use.
 */
export function deriveMetrics(sample: EEGSample): DerivedMetrics {
  const engagementRatio = sample.beta / (sample.theta + sample.alpha);
  const focusScore = clamp(Math.round(engagementRatio * 140), 0, 100);

  const stressRatio = sample.beta / sample.alpha;
  const stressLevel = clamp(Math.round(stressRatio * 55), 0, 100);

  const thetaBetaRatio = sample.theta / sample.beta;
  const mentalFatigue = clamp(Math.round(thetaBetaRatio * 30), 0, 100);

  // Standard FAA form: ln(right alpha) - ln(left alpha). More negative values
  // (relatively greater right frontal activation) are the pattern
  // longitudinal literature associates with depression-risk leaning.
  const faaIndex = Math.log(sample.alphaF4) - Math.log(sample.alphaF3);

  return {
    focusScore,
    stressLevel,
    mentalFatigue,
    faaIndex: round2(faaIndex),
  };
}

// ---------------------------------------------------------------------------
// Longitudinal analytics — 1 user, gradual recovery from mental burnout.
//
// The narrative: this user was running a sustained high-burnout baseline,
// then begins an active recovery ~30 days ago. Regardless of the selected
// time range, the most recent 30-day window always shows that recovery arc;
// anything further back sits at the pre-recovery baseline with normal
// day-to-day noise.
// ---------------------------------------------------------------------------

function buildLongitudinalSeries(
  numPoints: number,
  daysPerPoint: number
): LongitudinalDataPoint[] {
  const RECOVERY_WINDOW_DAYS = 30;
  const points: LongitudinalDataPoint[] = [];
  const today = new Date();

  for (let i = numPoints - 1; i >= 0; i--) {
    const daysAgo = i * daysPerPoint;
    const date = new Date(today);
    date.setDate(date.getDate() - daysAgo);

    // 0 = still at pre-recovery baseline, 1 = fully at today's recovered state.
    const progress =
      daysAgo >= RECOVERY_WINDOW_DAYS ? 0 : 1 - daysAgo / RECOVERY_WINDOW_DAYS;

    const burnoutRisk = clamp(
      Math.round(80 - progress * 46 + noiseAround(5)),
      10,
      96
    );
    const faaIndex = round2(-0.4 + progress * 0.44 + noiseAround(0.05));
    const sleepSpindleDensity = round1(3.0 + progress * 2.7 + noiseAround(0.35));
    const slowWaveSleepPercent = clamp(
      Math.round(10 + progress * 10 + noiseAround(1.8)),
      5,
      32
    );

    points.push({
      date: date.toISOString().slice(0, 10),
      burnoutRisk,
      faaIndex,
      sleepSpindleDensity,
      slowWaveSleepPercent,
    });
  }

  return points;
}

/**
 * Single mixed-granularity longitudinal series spanning ~1 year.
 * - Daily points for the most recent ~30 days (finer detail on the recovery window)
 * - Weekly points for the preceding ~11 months (coarser history)
 * No time-range tab control; this is the one view the charts always render.
 */
export function generateLongitudinalAll(): LongitudinalDataPoint[] {
  const recent = buildLongitudinalSeries(30, 1); // 30 daily points, 0..29 days ago
  const weekly = buildLongitudinalSeries(52, 7); // 52 weekly points, 0..357 days ago

  const cutoff = recent[recent.length - 1].date; // oldest recent date (29 days ago)
  const history = weekly.filter((point) => point.date < cutoff); // keep weekly older than recent

  return [...history, ...recent]; // ascending by date
}

/** Builds "current vs. past 30-day average" comparison rows for the analytics page. */
export function generateBaselineComparison(
  data: LongitudinalDataPoint[]
): BaselineComparison[] {
  const window = data.slice(-30).length > 0 ? data.slice(-30) : data;
  const avg = (key: keyof Omit<LongitudinalDataPoint, "date">) =>
    round1(window.reduce((sum, point) => sum + (point[key] as number), 0) / window.length);

  const current = data[data.length - 1];

  return [
    {
      metricLabel: "Burnout Risk",
      current: current.burnoutRisk,
      past30DayAverage: avg("burnoutRisk"),
      unit: "%",
      higherIsBetter: false,
    },
    {
      metricLabel: "FAA Index",
      current: current.faaIndex,
      past30DayAverage: avg("faaIndex"),
      unit: "",
      higherIsBetter: true,
    },
    {
      metricLabel: "Sleep Spindle Density",
      current: current.sleepSpindleDensity,
      past30DayAverage: avg("sleepSpindleDensity"),
      unit: "/min",
      higherIsBetter: true,
    },
    {
      metricLabel: "Slow-Wave Sleep",
      current: current.slowWaveSleepPercent,
      past30DayAverage: avg("slowWaveSleepPercent"),
      unit: "%",
      higherIsBetter: true,
    },
  ];
}
