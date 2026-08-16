# NeuroPulse AI — Frontend

A modular Next.js (App Router) + TypeScript + Tailwind CSS frontend for a
NeuroTech EEG monitoring platform. Every data source in this build is
simulated — there is no real hardware or LLM call — but every seam where a
real backend plugs in is explicitly marked and isolated.

## Stack

- Next.js 14 (App Router), React 18, TypeScript (strict)
- Tailwind CSS — theme tokens in `tailwind.config.ts`
- Recharts — EEG waveform + trend charts
- lucide-react — icons

## Setup

```bash
npm install
npm run dev
```

Open `http://localhost:3000` — it redirects to `/dashboard`.

## File structure

```
app/
  layout.tsx              Root layout: fonts, dark theme, wraps DashboardShell
  page.tsx                Redirects "/" -> "/dashboard"
  dashboard/page.tsx      Real-time Brain Monitor
  brainprint/page.tsx     Brainprint recognition & "unknown wave" enrollment
  analytics/page.tsx      Longitudinal analytics
  ai-consultant/page.tsx  AI Neuro-Consultant & chat
  globals.css

components/
  layout/     Sidebar, Header, DashboardShell (+ shared app-status context)
  monitor/    EEG waveform chart, metric cards, connection widget, page view
  input/      Data Input Panel: mode toggle, simulator controls, file upload, WebSocket panel
  brainprint/ Scanner (pulsing-ring UI), ProfileVerifiedPanel, UnknownWaveModal, page view
  analytics/  Time-range filter, trend chart, baseline comparison, page view
  ai/         Diagnostics summary, prompt chips, chat interface, page view
  ui/         Shared primitives (badges, status pills, glow panel)

hooks/
  useEEGStream.ts        Simple mock stream (used by the AI chat's live context)
  useSimulatorControls.ts  Hz/amplitude/noise/preset-driven simulator source
  useFileIngestion.ts      Parses + replays an uploaded/pasted file as a stream
  useWebSocketStream.ts    Connects to a local WebSocket (e.g. a Python backend)
  useDataSource.ts          Unifies the three sources above into one buffer+metrics shape
  useBrainprintScan.ts      Scan capture timing (idle -> scanning -> processing -> captured)

lib/
  types.ts               All shared TypeScript types
  mockData.ts             EEG sample synthesis, derived-metric math, 30-day burnout-recovery dataset
  simulatorPresets.ts      Deep Sleep / High Focus / Extreme Stress / Seizure Alert wave shaping
  dataIngestion.ts         CSV / JSON / raw-array / EDF-like text parsing
  brainprintUtils.ts       Cosine-similarity matching, multi-profile recognition, new-profile registration
  deepseekConfig.ts        DEEPSEEK_API_KEY placeholder — server-side only, see below
  deepseekApiHandler.ts    Client-facing sendToDeepSeekAI() + SSE streaming variant
```

## Real-Time Data Input Panel

The Live Monitor page now has three switchable input modes (`hooks/useDataSource.ts` unifies them):

- **Live Simulator** — sliders for Hz / amplitude (µV) / noise, plus one-click presets (Deep Sleep, High Focus, Extreme Stress, Seizure Alert). Seizure Alert also triggers a flashing risk banner.
- **File Upload / Data Injection** — drag-and-drop `.csv` / `.json`, or paste a raw numeric array, and it plays back as a live stream. A plain-text EDF-like export is supported on a best-effort basis; real binary `.edf` needs a server-side EDF library (out of scope for a frontend-only build) — this is flagged clearly in `lib/dataIngestion.ts`.
- **WebSocket Streaming** — connects to a local WebSocket server (e.g. a Python backend bridging real hardware) at a URL you supply, expecting JSON frames shaped like `{ delta, theta, alpha, beta, gamma }`.

## Dynamic Brainprint & "Unknown Wave" Detection

`components/brainprint/BrainprintView.tsx` runs every scan capture through `recognizeBrainprint()` against an in-memory list of known profiles (`lib/mockData.ts` → `MOCK_KNOWN_PROFILES`):

- **Recognized** → `ProfileVerifiedPanel` shows the matched nickname, similarity score, and a radar chart of that profile's historical metrics.
- **Unknown** → `UnknownWaveModal` pops up with the unidentified waveform, a nickname field, and "Save & Train into Brainprint Database" — which calls `registerNewProfile()` and adds it to the in-memory list (swap for a real POST + refetch in production).

## Wiring up DeepSeek

The chat UI (`components/ai/AIChatInterface.tsx`) calls `sendToDeepSeekAIStream()` (`lib/deepseekApiHandler.ts`), which POSTs to the backend's own `/api/deepseek-chat` endpoint — never to DeepSeek directly from the browser. The backend holds the `DEEPSEEK_API_KEY` and streams the SSE response back to the frontend token-by-token.

1. On the backend, copy `.env.example` to `.env` and set `DEEPSEEK_API_KEY`.
2. `lib/deepseekConfig.ts`'s `isDeepSeekConfigured()` reflects whether a key is configured (server-side only — the key is never exposed to the browser bundle).
3. Once a real key is set on the backend, `/api/deepseek-chat` returns a live streaming reply; when the key is unset the backend returns a 500 that the chat UI surfaces as an error state.

The reply streams over real SSE from the backend and is rendered live via `sendToDeepSeekAIStream()`'s `onToken` callback — no client-side fake reveal effect is used.

## Wiring up real EEG hardware

Add a fourth mode to `useDataSource.ts` (or replace `useSimulatorControls`) with your hardware SDK's subscription callback. Keep the same `EEGSample` shape (`lib/types.ts`) and nothing downstream needs to change.

## Important notes before any real deployment

- The neurofeedback formulas in `lib/mockData.ts` (`deriveMetrics`) and the
  FAA calculation are simplified, illustrative heuristics — not validated
  clinical algorithms. Any real depression/burnout/dementia-risk scoring
  needs a clinically validated signal-processing pipeline and clinician
  oversight, not this demo math.
- Brainprint similarity scoring should be computed and enforced server-side;
  never trust a client-computed match score for access control.
- Handling real EEG and biometric data implicates HIPAA (US) and similar
  health-data regulations elsewhere, and a platform making mental-health
  risk claims may fall under medical-device (e.g. FDA SaMD) regulation —
  get compliance and regulatory review before this becomes a real product.
