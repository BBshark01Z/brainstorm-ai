# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

NeuroPulse is a NeuroTech EEG monitoring platform with two services:
- **`neuropulse-ai/`** — Next.js 14 frontend (TypeScript, Tailwind CSS, Recharts)
- **`neuropulse-backend/`** — FastAPI backend (Python, MNE, SciPy, SQLite)

The platform provides real-time EEG monitoring, Brainprint biometric authentication, longitudinal analytics, and an AI neuro-consultant (DeepSeek integration). All data is simulated — no real hardware or LLM calls by default.

## Common Commands

### Frontend (`neuropulse-ai/`)
```bash
npm install          # Install dependencies
npm run dev          # Start dev server at localhost:3000 (redirects to /dashboard)
npm run build        # Production build
npm start            # Start production server
npm run lint         # Run Next.js lint
```

### Backend (`neuropulse-backend/`)
```bash
python3 -m venv venv
venv\Scripts\activate          # Windows
pip install -r requirements.txt
uvicorn main:app --reload --port 8765   # Start backend
```

> **`.env` changes require a full backend restart** — `--reload` only watches `*.py`, and
> `load_dotenv` runs once at import (main.py:44). Edit `.env` → stop uvicorn and start again.
> Edits to `.py` files normally hot-reload.

Backend docs available at `http://localhost:8765/docs` (Swagger UI).

## Architecture

### Frontend — `neuropulse-ai/`

**Pages** (App Router):
- `app/dashboard/page.tsx` — Real-time Brain Monitor (EEG waveform chart, metric cards, connection widget)
- `app/brainprint/page.tsx` — Brainprint scanning, profile recognition, "unknown wave" enrollment
- `app/analytics/page.tsx` — Longitudinal trends, baseline comparison
- `app/ai-consultant/page.tsx` — AI neuro-consultant chat interface
- `app/api/ai/consult/route.ts` — (legacy doc; this route is not present) — AI calls go through `lib/deepseekApiHandler.ts` directly to the backend `/api/deepseek-chat`; the API key lives only server-side on the backend, never in the browser bundle

**Data flow** — two input modes are unified through a single seam:
- `hooks/useDataSource.ts` → returns `{ buffer, metrics, latestSample }` regardless of active input mode
  - `useFileIngestion.ts` — parses uploaded CSV/JSON/raw array, replays as live stream
  - `useWebSocketStream.ts` — connects to backend WebSocket at `ws://localhost:8765/ws/eeg-stream`
- **Live Simulator mode has been removed.** All mock/simulator code (`useSimulatorControls.ts`, `SimulatorControls.tsx`, `useSimulatorEEG.tsx`, `simulatorPresets.ts`) has been deleted. `InputMode` is now `"file" | "websocket"` only.

**Context providers**:
- `hooks/useEEGContext.tsx` — wraps app with `EEGProvider` (root layout)
- `hooks/useSimulatorEEG.tsx` — simulator-specific EEG context

**Key libraries**:
- `lib/types.ts` — single source of truth for all TypeScript data shapes (`EEGSample`, `DerivedMetrics`, `BrainprintProfile`, etc.)
- `lib/mockData.ts` — EEG sample synthesis, `deriveMetrics()` math, 30-day burnout-recovery dataset
- `lib/brainprintUtils.ts` — cosine-similarity matching, multi-profile recognition, `registerNewProfile()`
- `lib/dataIngestion.ts` — CSV/JSON/raw-array/EDF-like text parsing
- `lib/simulatorPresets.ts` — wave-shaping presets
- `lib/deepseekConfig.ts` / `lib/deepseekApiHandler.ts` — DeepSeek API handler + SSE streaming client

**Component hierarchy**:
- `components/layout/` — `DashboardShell`, `Sidebar`, `Header`, app-status context
- `components/monitor/` — `EEGWaveformChart`, `MetricsCard`, `ConnectionStatusWidget`, `LiveMonitorView`
- `components/input/` — `DataInputPanel`, `InputModeToggle`, `SimulatorControls`, `FileUploadPanel`, `WebSocketPanel`
- `components/brainprint/` — `BrainprintScanner`, `BrainprintView`, `ProfileVerifiedPanel`, `UnknownWaveModal`
- `components/analytics/` — `AnalyticsView`, `TrendChart`, `TimeRangeFilter`, `BaselineComparisonPanel`
- `components/ai/` — `DiagnosticsSummary`, `PromptChips`, chat interface
- `components/ui/` — shared primitives (badges, status pills, glow panel)

### Backend — `neuropulse-backend/`

**Entry point**: `main.py` — FastAPI app with CORS middleware, startup DB init, DeepSeek consultant singleton.

**API endpoints**:
| Method | Path | Description |
|--------|------|-------------|
| GET | `/` | Root welcome |
| GET | `/health` | Liveness check + DeepSeek config status |
| POST | `/api/analyze` | Full feature extraction for raw channels → returns `AnalyzeResponse` with embedding vector |
| POST | `/api/brainprint/verify` | Match embedding against enrolled profiles (cosine + Mahalanobis) |
| POST | `/api/brainprint/register` | Enroll new nickname + embedding |
| GET | `/api/brainprint/profiles` | List enrolled profiles (no raw embeddings) |
| POST | `/api/deepseek-chat` | AI neuro-consultant chat |
| GET | `/api/deepseek-chat/history` | AI consultant chat history |
| WS | `/ws/eeg-stream` | Auto-streams computed EEG metrics every ~300ms |

**Auth**: JWT-based authentication is implemented — `get_current_user` dependency validates the bearer token against `SECRET_KEY`, and `/api/deepseek-chat` (and other protected routes) return `401` when the token is missing or invalid. Login/register endpoints issue the JWT. (Note: this supersedes an earlier version of this doc that said the API had no auth — that was true when this file was first generated, but auth was added afterward and this doc wasn't updated at the time.)

**Services**:
- `services/feature_extractor.py` — Bandpower via Welch PSD, differential entropy, Hjorth parameters, FAA, TBR, embedding vector builder. Uses MNE for filtering (falls back to SciPy Butterworth).
- `services/brainprint_ml.py` — Two-metric verification: cosine similarity (per-profile) + Mahalanobis distance (population-level OOD detection). VERIFIED only if both thresholds pass. Falls back to cosine-only until 8+ profiles enrolled.
- `services/deepseek_service.py` — `DeepSeekBrainConsultant`: real DeepSeek call if `DEEPSEEK_API_KEY` set, otherwise raises `HTTPException(500)` (no mock/fallback inside the service).
- `services/demo_signal_source.py` — Synthetic EEG signal generator for WebSocket stream
- `services/eeg_dataset.py` — EEG dataset utilities

**Database**: `db/database.py` — Plain `sqlite3` (no ORM), single table `brainprint_profiles`. Each function opens/closes its own connection to avoid "database is locked" bugs with FastAPI async handlers.

**Schemas**: `schemas.py` — All Pydantic models shared between FastAPI routes and services.

## Key Data Contracts

**`EEGSample`** (frontend `lib/types.ts` / backend WebSocket payload):
```ts
{ timestamp, delta, theta, alpha, beta, gamma, alphaF3, alphaF4 }
```

**`AnalyzeResponse`** (backend `schemas.py`):
```python
{ channels: [ChannelFeatureSet], faa_index: float?, embedding: List[float] }
```

**`AnalyzeRequest`** input to `/api/analyze`:
```python
{ channels: [RawChannelSignal], sampling_rate_hz: float, notch_freq_hz: float }
```

The embedding vector shape from `AnalyzeResponse.embedding` is the same shape fed into `/api/brainprint/verify` and `/api/brainprint/register` — this is the bridge between feature extraction and Brainprint ML.

## Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `DEEPSEEK_API_KEY` | (unset) | API key for real DeepSeek calls; unset = 500 from the service |
| `DEEPSEEK_API_ENDPOINT` | DashScope compatible-mode | DeepSeek API endpoint URL |
| `DEEPSEEK_MODEL` | `deepseek-v4-flash-0731` | DeepSeek model ID |
| `DATABASE_PATH` | `./data/brainprint.db` | SQLite database location |
| `CORS_ORIGINS` | `http://localhost:3000,http://127.0.0.1:3000` | Comma-separated CORS origins |
| `BRAINPRINT_SIMILARITY_THRESHOLD` | `0.82` | Min cosine similarity for VERIFIED |
| `BRAINPRINT_MAHALANOBIS_THRESHOLD` | `3.0` | Max Mahalanobis distance for in-distribution |
| `MIN_PROFILES_FOR_MAHALANOBIS` | `8` | Min profiles before Mahalanobis kicks in |
| `SECRET_KEY` | (must be set) | Signing key for JWT auth |

## Important Notes

- **All data is simulated** — no real EEG hardware or LLM calls by default
- **Clinical algorithms are illustrative heuristics** — not validated for clinical use
- **JWT authentication is implemented** on protected endpoints — see "Auth" above; ensure `SECRET_KEY` is set to a strong, unique value before real deployment
- **SQLite** is fine for prototype scale; real deployment needs proper database with row-level access control
- **Brainprint matching** is computed server-side; never trust client-computed match scores for access control
- Frontend simulator and backend signal processing are intentionally **not required to match sample-for-sample** — the frontend simulator is for UI dev; the backend is where real signal processing happens

## Claude Code Setup (Skills / Memory)

This repo uses `npx skills` to pull in supplemental Claude Code skills. If a skills-install command fails with `spawn git ENOENT`, Git isn't installed or isn't on PATH — install it first (`winget install --id Git.Git -e --source winget` on Windows), restart the terminal, then re-run.

Skills currently set up for this project:
```bash
npx skills add thedotmack/claude-mem --agent claude-code
npx skills add OthmanAdi/planning-with-files --agent claude-code
npx skills add affaan-m/everything-claude-code --skill strategic-compact --agent claude-code
npx skills add nextlevelbuilder/ui-ux-pro-max-skill --agent claude-code
npx skills add hardikpandya/stop-slop --agent claude-code
```

- **claude-mem** — persistent memory across Claude Code sessions for this repo
- **planning-with-files** — file-based task/plan tracking
- **strategic-compact** (from everything-claude-code) — context-compaction strategy
- **ui-ux-pro-max-skill** — UI/UX review guidance for the frontend
- **stop-slop** — output-quality guardrails
