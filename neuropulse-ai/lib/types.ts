// ---------------------------------------------------------------------------
// NeuroPulse AI — Shared Type Definitions
// Single source of truth for every data shape passed between the mock EEG
// stream, the UI components, and the (future) real EEG + DeepSeek AI backends.
// ---------------------------------------------------------------------------

/** The five canonical EEG frequency bands the platform tracks. */
export type EEGBand = "delta" | "theta" | "alpha" | "beta" | "gamma";

export const EEG_BAND_RANGES: Record<EEGBand, string> = {
  delta: "0.5–4 Hz",
  theta: "4–8 Hz",
  alpha: "8–12 Hz",
  beta: "12–30 Hz",
  gamma: "30–100 Hz",
};

/**
 * A single real-time EEG sample.
 * `delta`..`gamma` are aggregate band power (µV) used for the live waveform.
 * `alphaF3` / `alphaF4` are left/right frontal alpha power specifically for
 * the Frontal Alpha Asymmetry (FAA) calculation — real hardware would report
 * these per-electrode rather than as a single averaged "alpha" value.
 */
export interface EEGSample {
  timestamp: number; // ms since epoch
  delta: number;
  theta: number;
  alpha: number;
  beta: number;
  gamma: number;
  alphaF3: number; // left frontal electrode (F3) alpha power
  alphaF4: number; // right frontal electrode (F4) alpha power
}

/** Derived real-time cognitive/affective metrics computed from EEGSample(s). */
export interface DerivedMetrics {
  focusScore: number; // 0-100
  stressLevel: number; // 0-100
  mentalFatigue: number; // 0-100
  faaIndex: number; // signed float, roughly -1..1. Negative = withdrawal/depression-risk leaning.
}

/** Payload handed to the AI consultant so it has grounded context. */
export interface EEGDataPayload {
  recentSamples: EEGSample[];
  metrics: DerivedMetrics;
  userId: string;
  capturedAt: number;
}

// --------------------------- Brainprint (biometric auth) -------------------

export type BrainprintStatus =
  | "idle"
  | "scanning"
  | "processing"
  | "verified"
  | "denied"
  | "unenrolled";

export interface BrainprintProfile {
  userId: string;
  displayName: string;
  enrolled: boolean;
  status: BrainprintStatus;
  similarityScore: number; // 0-100, last verification attempt
  signatureHash: string; // mock hash representing the enrolled neural signature
  enrolledAt: string; // ISO date
  lastVerifiedAt: string | null; // ISO date
  verificationThreshold: number; // minimum similarity % required to grant access
}

// --------------------------- Longitudinal analytics -------------------------

export interface LongitudinalDataPoint {
  date: string; // ISO date (day granularity)
  burnoutRisk: number; // 0-100, higher = more risk
  faaIndex: number; // depression-risk marker, same scale as DerivedMetrics.faaIndex
  sleepSpindleDensity: number; // spindles per minute of stage-2 sleep, cognitive marker
  slowWaveSleepPercent: number; // % of total sleep spent in slow-wave sleep
}

export interface BaselineComparison {
  metricLabel: string;
  current: number;
  past30DayAverage: number;
  unit: string;
  /** Whether a higher value is clinically "better" for this metric — controls
   * which direction an up/down arrow should be colored as good vs. bad. */
  higherIsBetter: boolean;
}

// --------------------------- AI Neuro-Consultant -----------------------------

export type InsightSeverity = "info" | "warning" | "critical";

export interface DiagnosticInsight {
  id: string;
  title: string;
  description: string;
  severity: InsightSeverity;
  timestamp: number;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
}

export interface DeepSeekAIRequest {
  userPrompt: string;
  eegContextData: EEGDataPayload;
}

/**
 * Response from the backend /api/deepseek-chat endpoint.
 * No more usedMock/mockReason — the backend always returns a real DeepSeek reply
 * (or raises a 500 if DEEPSEEK_API_KEY is not configured).
 */
export interface DeepSeekAIResponse {
  reply: string;
  /** Optional structured flags the UI can render as chips/badges alongside the reply. */
  flaggedMarkers?: string[];
  latencyMs: number;
}

// ---------------------------------------------------------------------------
// Real-time data ingestion — File Upload / WebSocket only
// ---------------------------------------------------------------------------

export type InputMode = "file" | "websocket";

export type IngestedFileFormat = "csv" | "json" | "raw" | "edf-like";

export interface FileIngestionResult {
  format: IngestedFileFormat;
  samples: EEGSample[];
  sourceName: string;
  warnings: string[];
}

export type WebSocketConnectionState = "disconnected" | "connecting" | "connected" | "error";

// ---------------------------------------------------------------------------
// Dynamic Brainprint recognition (multi-profile, "unknown wave" detection)
// ---------------------------------------------------------------------------

export interface KnownBrainprintProfile {
  id: string;
  nickname: string;
  signatureVector: number[];
  enrolledAt: string;
  sessionsCount: number;
  /** Small set of historical readings used to render the personalized radar/trend chart. */
  historicalMetrics: {
    label: string; // e.g. "Focus", "Calm", "Stress Ctrl", "Sleep Quality", "Recovery"
    value: number; // 0-100
  }[];
}

export type BrainprintRecognitionResult =
  | {
      status: "recognized";
      profile: KnownBrainprintProfile;
      similarityScore: number;
      /** Mahalanobis out-of-distribution distance from the backend verify
       *  response (population-level novelty). Null when too few profiles
       *  enrolled for it to be computed. Real backend value. */
      noveltyScore: number | null;
    }
  | { status: "unknown"; capturedVector: number[]; similarityScore: number };

// ---------------------------------------------------------------------------
// Auth types
// ---------------------------------------------------------------------------

export interface User {
  user_id: number;
  email: string;
  nickname: string;
  created_at: string;
}

export interface AuthTokens {
  access_token: string;
  token_type: string;
}

// ---------------------------------------------------------------------------
// Connection status for the headset/device widget
// ---------------------------------------------------------------------------

export type ImpedanceQuality = "good" | "fair" | "poor";

export interface ChannelImpedance {
  channel: string;
  kOhm: number;
}

export interface ConnectionStatus {
  deviceName: string;
  connected: boolean;
  signalStrength: number;
  batteryPercent: number;
  impedanceQuality: ImpedanceQuality;
  channelImpedances: ChannelImpedance[];
}
