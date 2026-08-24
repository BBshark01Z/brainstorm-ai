# PROJECT_LOG.md

# NeuroPulse AI โ€” Project Activity Log

## 2026-08-06

### Timestamp
2026-08-06T00:00:00Z (Initial comprehensive update)

### ML Training Pipeline & Real-time Brain State Inference
**Time:** ~03:30 UTC+7

#### 1. Signal Preprocessing โ€” SciPy Butterworth Filters
- **File**: `neuropulse-backend/services/feature_extractor.py`
- **Added functions**:
  - `apply_bandpass_filter(data, lowcut=0.5, highcut=50.0, fs=256.0, order=4)` โ€” Butterworth bandpass using `scipy.signal.butter` + `filtfilt` (zero-phase forward-backward filtering)
  - `apply_notch_filter(data, notch_freq=50.0, fs=256.0, quality_factor=30.0)` โ€” Butterworth bandstop notch filter for 50Hz mains interference
- **Updated import**: `from scipy.signal import butter, filtfilt, welch`

#### 2. Biomarker Calculations
- **File**: `neuropulse-backend/services/feature_extractor.py`
- **Added functions**:
  - `compute_focus_index(band_power)` โ€” Focus = Beta / (Theta + Alpha)
  - `compute_stress_index(band_power)` โ€” Stress = High Beta (60% of beta) / Alpha
  - `compute_relaxation_index(band_power)` โ€” Relaxation = Alpha / Total Power
  - `compute_all_biomarkers(band_power)` โ€” Computes all 3 biomarkers at once
- **Formulas**:
  ```
  Focus Index    = beta / (theta + alpha)      # Higher = more focused/alert
  Stress Index   = (beta * 0.6) / alpha         # Higher = more anxious/stressed
  Relax Index    = alpha / total_power          # Higher = more relaxed/resting
  ```

#### 3. ML Model Training Pipeline
- **Created**: `neuropulse-backend/ml/train_brain_model.py`
- **Created**: `neuropulse-backend/ml/` directory
- **Created**: `neuropulse-backend/models/` directory
- **Features**:
  - Synthetic EEG dataset generator (5,000 samples, 3 brain states: focus/stress/relax)
  - Random Forest Classifier (200 estimators, max_depth=20, balanced classes)
  - StandardScaler for feature normalization
  - 5-fold cross-validation
  - Feature importance analysis
  - Model serialization via `joblib`
- **Training Results**:
  - Test Accuracy: **0.9960**
  - Test F1 (macro): **0.9959**
  - CV F1: **0.9925** (+/- 0.0032)
  - Top features: alpha (0.24), relaxation_index (0.22), stress_index (0.21), focus_index (0.15)
- **Output files**:
  - `models/brain_state_model.joblib` โ€” serialized pipeline (scaler + model)
  - `models/model_metrics.json` โ€” training metrics and feature importances
- **Dependencies installed**: `scikit-learn`, `joblib`

#### 4. Real-time Brain State Inference in WebSocket
- **File**: `neuropulse-backend/main.py`
- **Changes**:
  - Added `load_brain_state_model()` โ€” loads `models/brain_state_model.joblib` at startup
  - Called in `_on_startup()` โ’ model ready before accepting connections
  - In WebSocket `eeg_stream()`: every tick now computes:
    - Biomarkers via `feature_extractor.compute_all_biomarkers()`
    - Brain state prediction via trained Random Forest model
  - **New WebSocket payload fields**:
    - `focus_index` (float) โ€” Focus biomarker
    - `stress_index` (float) โ€” Stress biomarker
    - `relaxation_index` (float) โ€” Relaxation biomarker
    - `brain_state` (str) โ€” "focus" | "stress" | "relax"
    - `brain_confidence` (float) โ€” 0-1 confidence score
    - `brain_probabilities` (dict) โ€” P(focus), P(stress), P(relax) per tick

#### 5. Updated Dependencies
- `neuropulse-backend/venv/`: installed `scikit-learn==1.9.0`, `joblib==1.5.3`
- Recommended: add `scikit-learn` and `joblib` to `requirements.txt`

### Files Changed

| File | Action | Description |
|------|--------|-------------|
| `neuropulse-backend/services/feature_extractor.py` | Modified | Added scipy Butterworth filters + biomarker functions |
| `neuropulse-backend/main.py` | Modified | Added model loading + real-time inference in WebSocket |
| `neuropulse-backend/ml/train_brain_model.py` | Created | Full ML training pipeline with synthetic data |
| `neuropulse-backend/models/brain_state_model.joblib` | Created | Trained Random Forest model artifact |
| `neuropulse-backend/models/model_metrics.json` | Created | Training metrics and feature importances |
| `PROJECT_LOG.md` | Updated | This log |

### Next Steps

1. **Add to requirements.txt**: `scikit-learn`, `joblib`
2. **Frontend integration**: Update `EEGSample` type and UI components to display:
   - Focus/Stress/Relaxation index values
   - Brain state classification (Focus/Stress/Relax) with confidence bar
   - Probability distribution across brain states
3. **Model retraining**: As real EEG data becomes available, replace synthetic data with real recordings
4. **Model versioning**: Consider saving multiple model versions (`models/brain_state_v1.joblib`, etc.)
5. **Health endpoint**: Add `GET /health` field showing model load status

---

### Completed Tasks

#### 1. WebSocket Connection Fix (Task #1)
- **Problem**: WebSocket stuck on "Connecting" status indefinitely
- **Fixes Applied**:
  - Updated `neuropulse-ai/hooks/useWebSocketStream.ts` with:
    - Dynamic WS URL resolution from `NEXT_PUBLIC_WS_URL` or `NEXT_PUBLIC_API_URL`
    - Heartbeat (ping/pong) system with 15s interval and 5s timeout
    - Improved auto-reconnect (up to 50 attempts, exponential back-off up to 12s)
    - Better error handling for abnormal close codes (1006, 0)
    - Proper cleanup on unmount and explicit disconnect
  - Updated `neuropulse-backend/main.py` WebSocket endpoint:
    - Added bidirectional ping/pong message handling
    - Client can request raw signal decomposition via WebSocket
    - Relative power calculation for more stable display values
  - Updated `neuropulse-ai/.env.local` with `NEXT_PUBLIC_WS_URL` config
  - Updated `WebSocketPanel.tsx` with Share button and heartbeat status indicator

#### 2. Raw Signal Decomposition (Task #2)
- **Feature**: Backend auto-decomposes raw EEG signals into 5 brain wave bands
- **Implementation**:
  - Added `/api/decompose` POST endpoint in `main.py`
  - Uses Welch PSD (`scipy.signal.welch`) for frequency analysis
  - Band ranges: Delta (0.5-4Hz), Theta (4-8Hz), Alpha (8-13Hz), Beta (13-30Hz), Gamma (30-45Hz)
  - Returns both absolute and relative power (summing to 1.0)
  - Added `_decompose_raw_to_bands()` helper function for reuse
  - Added `_compute_relative_power()` utility function
- **Dependencies**: `scipy` and `numpy` already in `requirements.txt` โ…

#### 3. Shareable Link & Network Sharing System (Task #3)
- **Backend Endpoints** (`main.py`):
  - `POST /api/share/report` โ€” Create shareable report (in-memory storage)
  - `GET /api/share/report/<id>` โ€” Retrieve shared report (public)
  - `DELETE /api/share/report/<id>` โ€” Delete shared report
  - `GET /api/share/reports` โ€” List all shared reports
- **Frontend Component** (`components/share/ShareReportButton.tsx`):
  - Reusable "Share Report" button with copy-to-clipboard
  - Supports dashboard, brainprint, and analytics report types
  - Shows "Copied!" feedback on success
  - Error handling with user-friendly messages
- **Network Configuration**:
  - Backend binds to `0.0.0.0` via uvicorn `--host 0.0.0.0` for LAN access
  - Frontend binds to `0.0.0.0` via `HOST=0.0.0.0 npm run dev`
  - External tunnel: `lt --port 3000` (localtunnel) or `ngrok http 3000`

#### 4. Shareable Link Integration (Task #3 continued)
- **Integrated ShareReportButton into Dashboard** (`LiveMonitorView.tsx`):
  - Added share button in page header with EEG metrics snapshot
  - Share data includes: focus/stress/fatigue scores, FAA index, latest sample, capture time
- **Integrated ShareReportButton into BrainprintView** (`BrainprintView.tsx`):
  - Added share button in page header with brainprint verification results
  - Share data includes: recognition status, similarity score, enrolled profiles list
  - Updated API calls to use `NEXT_PUBLIC_API_URL` env var instead of hardcoded URL
- **Updated WebSocketPanel.tsx**: Added Share button in header, heartbeat status indicator

#### 5. Persistence System (Task #4)
- **Created**: `PROJECT_LOG.md` (this file) โ€” Activity log with timestamps
- **Created**: `AI_INSTRUCTIONS.md` โ€” AI collaborator rules (Thai language)

### Files Changed

| File | Action | Description |
|------|--------|-------------|
| `neuropulse-backend/main.py` | Modified | Added heartbeat, decompose endpoint, share endpoints |
| `neuropulse-ai/hooks/useWebSocketStream.ts` | Modified | Heartbeat, improved reconnect, dynamic URL |
| `neuropulse-ai/components/input/WebSocketPanel.tsx` | Modified | Added Share button, heartbeat status |
| `neuropulse-ai/components/monitor/LiveMonitorView.tsx` | Modified | Added ShareReportButton in header |
| `neuropulse-ai/components/brainprint/BrainprintView.tsx` | Modified | Added ShareReportButton, env var API URLs |
| `neuropulse-ai/.env.local` | Modified | Added NEXT_PUBLIC_WS_URL |
| `neuropulse-ai/components/share/ShareReportButton.tsx` | Created | Shareable report UI component |
| `PROJECT_LOG.md` | Created/Updated | This file โ€” activity log |
| `AI_INSTRUCTIONS.md` | Created | AI collaborator rules (Thai) |

### Next Steps / Warnings

1. **Backend Startup**: Run with `--host 0.0.0.0` for network sharing:
   ```bash
   uvicorn main:app --reload --port 8765 --host 0.0.0.0
   ```

2. **Frontend Startup**: Run with `HOST=0.0.0.0` for network sharing:
   ```powershell
   $env:HOST="0.0.0.0"; npm run dev
   ```

3. **External Access**: Use tunnel for external sharing:
   ```bash
   npx localtunnel --port 3000
   # or
   npx ngrok http 3000
   ```

4. **Share Reports**: Currently stored in-memory only. For production:
   - Add SQLite persistence for shared reports
   - Add TTL/expiry for reports
   - Add authentication for report creation

5. **WebSocket Path**: Backend WebSocket is at `/ws/eeg-stream`. Ensure frontend URL matches.

6. **Heartbeat**: Both frontend and backend now use ping/pong. If connections still drop, check:
   - Firewall rules blocking WebSocket upgrades
   - Proxy/load balancer configurations
   - `DISABLE_DEMO_STREAM` env var (set to "true" in production)

---

### 2026-08-06T03:45+07:00 โ€” Tunnel Proxy Fix, NameError Fix, WebSocket Middleware

#### 1. Backend Fix โ€” NameError 'np' in WebSocket brain state prediction
- **File**: `neuropulse-backend/main.py`
- **Problem**: `np.array(...)` called at line ~709 inside `eeg_stream()` but `numpy` was only imported inside `_decompose_raw_to_bands()` and `decompose_signal()` โ€” not at module level. Caused `NameError: name 'np' is not defined` when WebSocket tried brain state inference.
- **Fix**: Added `import numpy as np` at top-level imports (line 38) so it's available everywhere in the module.

#### 2. Backend Fix โ€” `load_brain_state_model()` fallback
- **File**: `neuropulse-backend/main.py`
- **Problem**: If `models/brain_state_model.joblib` doesn't exist, the function didn't log anything and could leave `_brain_state_pipeline` in an undefined state.
- **Fix**: Added explicit check for `_MODEL_PATH.exists()` before `joblib.load()`. If model not found โ’ logs info message + returns `None`. WebSocket falls back to biomarker-only mode (sends `brain_state: null`, biomarkers still computed). No Uvicorn crash.

#### 3. Next.js WebSocket Proxy Middleware
- **File**: `neuropulse-ai/middleware.ts` (NEW)
- **Problem**: Next.js `async rewrites()` in `next.config.js` does NOT handle WebSocket upgrade headers (`Upgrade: websocket`, `Connection: Upgrade`). When running behind a tunnel (Cloudflare/ngrok), the browser opens `wss://tunnel-url/ws/eeg-stream` but Next.js rewrites only forward the URL path โ€” the WebSocket upgrade handshake fails.
- **Fix**: Created `middleware.ts` that intercepts `/ws/:path*` requests, preserves `Upgrade`/`Connection`/`Sec-WebSocket-*` headers, and rewrites to `http://127.0.0.1:8765/ws/:path*`. The backend receives the proper WebSocket upgrade request.
- **Note**: REST API rewrites (`/api/*`) continue to be handled by `next.config.js` rewrites (they don't need upgrade handling).

#### 4. Frontend WebSocket URL โ€” Already Correct
- **File**: `neuropulse-ai/hooks/useWebSocketStream.ts`
- **Verified**: `getWsUrl()` already handles WSS auto-detection:
  - Line 74: `window.location.protocol === "https:" ? "wss:" : "ws:"`
  - Line 75: `${proto}//${window.location.host}/ws/eeg-stream`
  - When behind tunnel `https://abc.trycloudflare.com` โ’ connects to `wss://abc.trycloudflare.com/ws/eeg-stream`
  - Middleware intercepts `/ws/eeg-stream` and proxies to backend `http://127.0.0.1:8765/ws/eeg-stream`
  - No hardcoding of `127.0.0.1:8765` in browser-side code (only as env-var fallback)

### Files Changed

| File | Action | Description |
|------|--------|-------------|
| `neuropulse-backend/main.py` | Modified | Added `import numpy as np` (line 38), improved `load_brain_state_model()` fallback |
| `neuropulse-ai/middleware.ts` | Created โ’ Deleted | WebSocket proxy middleware โ€” DELETED (Next.js Edge Middleware cannot handle WS upgrade) |
| `PROJECT_LOG.md` | Updated | This log |

### Tunnel Proxy Architecture (End-to-End)

```
Browser (tunnel domain)
  wss://abc.trycloudflare.com/ws/eeg-stream
        โ”
        โ–ผ
  Next.js Dev Server (localhost:3000)
    middleware.ts intercepts /ws/*
    preserves Upgrade/Connection/Sec-WebSocket-* headers
    rewrites to backend URL
        โ”
        โ–ผ
  Backend (localhost:8765)
    FastAPI WebSocket endpoint /ws/eeg-stream
    sends EEG metrics + biomarkers + brain_state every 300ms
        โ”
        โ–ผ
  Browser receives WebSocket frames
    useWebSocketStream.ts parses JSON
    updates EEGSample state โ’ UI renders
```

---

### 2026-08-06T04:30+07:00 โ€” WebSocket "Connecting..." Root Cause Fix

#### 1. ROOT CAUSE: `localhost` vs `127.0.0.1` on Windows
- **File**: `neuropulse-ai/hooks/useEEGContext.tsx` (line 104)
- **Problem**: `EEGProvider` (rendered in root `layout.tsx`, active on ALL pages) used hardcoded `ws://localhost:8765/ws/eeg-stream`. On Windows, `localhost` can resolve to IPv6 `::1`, but the backend binds to IPv4 `127.0.0.1` only. The WebSocket upgrade handshake to `ws://[::1]:8765/ws/eeg-stream` fails silently โ€” browser stays on "Connecting..." indefinitely.
- **Fix**: Changed fallback URL from `ws://localhost:8765/ws/eeg-stream` to `ws://127.0.0.1:8765/ws/eeg-stream`. Also checks `process.env.NEXT_PUBLIC_WS_URL` first so `.env.local` takes priority.
- **Code change**:
  ```diff
  - const url = wsUrl ?? "ws://localhost:8765/ws/eeg-stream";
  + const url = wsUrl ?? process.env.NEXT_PUBLIC_WS_URL ?? "ws://127.0.0.1:8765/ws/eeg-stream";
  ```

#### 2. Removed `/ws/*` rewrite from `next.config.js`
- **File**: `neuropulse-ai/next.config.js`
- **Problem**: Next.js `async rewrites()` does NOT handle WebSocket upgrade headers (`Upgrade: websocket`, `Connection: Upgrade`). Even though the frontend connects directly to `ws://127.0.0.1:8765`, the `/ws/*` rewrite rule could interfere if any request ever hits the Next.js dev server first.
- **Fix**: Removed the `/ws/:path*` rewrite rule. Only `/api/*` REST proxy remains.

#### 3. Two WebSocket Connections โ€” Known State
There are currently **2 WebSocket connections** active:
1. `EEGProvider` (root layout) โ€” always active, provides `latestSample`, `metrics`, `connectionLabel` to all pages
2. `useWebSocketStream` (dashboard page via `useDataSource`) โ€” page-level, provides `buffer`, `webSocket` state
Both now target `ws://127.0.0.1:8765/ws/eeg-stream`. The dual connection is redundant but not harmful โ€” both send/receive the same data. A future refactor could consolidate them into a single source of truth.

### Files Changed

| File | Action | Description |
|------|--------|-------------|
| `neuropulse-ai/hooks/useEEGContext.tsx` | Modified | Fixed fallback URL: `localhost` โ’ `127.0.0.1`, added env var check |
| `neuropulse-ai/next.config.js` | Modified | Removed `/ws/*` rewrite rule (Next.js can't proxy WebSocket upgrades) |
| `PROJECT_LOG.md` | Updated | This log |

---

### 2026-08-06T04:15+07:00 โ€” WebSocket Hardcoded URL + .env.local Enforcement

#### 1. Enforced `NEXT_PUBLIC_WS_URL` in `.env.local`
- **File**: `neuropulse-ai/.env.local`
- **Problem**: `NEXT_PUBLIC_WS_URL` was left empty (`NEXT_PUBLIC_WS_URL=`), relying on runtime auto-detection in `getWsUrl()`. This caused inconsistency โ€” if the env var was somehow empty at build time, the fallback logic might not trigger correctly.
- **Fix**: Set explicit value:
  - `NEXT_PUBLIC_WS_URL=ws://127.0.0.1:8765/ws/eeg-stream` โ€” forces direct backend connection on localhost
  - `NEXT_PUBLIC_API_URL=http://127.0.0.1:8765` โ€” REST API also targets backend directly
- **Why**: `NEXT_PUBLIC_*` env vars are baked into the bundle at **build time**, not runtime. If the dev server restarts without reloading the env, stale values could cause wrong WS URL. Explicit = no ambiguity.

#### 2. Verified `getWsUrl()` priority order (no changes needed)
- **File**: `neuropulse-ai/hooks/useWebSocketStream.ts`
- **Verified**: `getWsUrl()` already correctly prioritizes:
  1. `NEXT_PUBLIC_WS_URL` env var (highest) โ’ hardcoded `ws://127.0.0.1:8765/ws/eeg-stream`
  2. Localhost โ’ direct `ws://127.0.0.1:8765/ws/eeg-stream`
  3. External HTTPS โ’ `wss://${window.location.host}/ws/eeg-stream`
  4. Fallback โ’ `ws://127.0.0.1:8765/ws/eeg-stream`
- **No code changes** โ€” the function already does exactly what's needed. The `.env.local` update ensures step 1 always fires first.

### Files Changed

| File | Action | Description |
|------|--------|-------------|
| `neuropulse-ai/.env.local` | Modified | Set explicit `NEXT_PUBLIC_WS_URL=ws://127.0.0.1:8765/ws/eeg-stream` |
| `PROJECT_LOG.md` | Updated | This log |

---

### 2026-08-06T04:00+07:00 โ€” WebSocket "Connecting" Fix: Remove Middleware, Direct Backend Connection

#### 1. Deleted `neuropulse-ai/middleware.ts`
- **Reason**: Next.js Edge Middleware **cannot** proxy WebSocket upgrade streams. The middleware attempted to rewrite `/ws/*` requests to the backend, but Edge Middleware runs in the browser CDN edge โ€” it cannot maintain a persistent bi-directional WebSocket tunnel to the origin backend. Result: connection would hang on "Connecting" indefinitely.

#### 2. Rewrote `getWsUrl()` in `useWebSocketStream.ts`
- **Problem**: `getWsUrl()` previously routed localhost through `window.location.host` โ’ `ws://localhost:3000/ws/eeg-stream`. Next.js `async rewrites()` forwards the URL path but does NOT handle WebSocket upgrade headers (`Upgrade: websocket`, `Connection: Upgrade`). Browser sends upgrade, Next.js ignores it, connection hangs on "Connecting".
- **Fix**: New priority order:
  1. **`NEXT_PUBLIC_WS_URL` env var** โ’ use as-is (highest priority, full control)
  2. **Localhost** (`localhost` / `127.0.0.1` / `0.0.0.0`) โ’ direct connection to `ws://127.0.0.1:8765/ws/eeg-stream` โ€” bypasses Next.js entirely
  3. **External HTTPS domain** (Cloudflare Tunnel, ngrok) โ’ `wss://${window.location.host}/ws/eeg-stream` โ€” tunnel handles the upgrade
  4. **Fallback** โ’ `ws://127.0.0.1:8765/ws/eeg-stream`

#### 3. Added Debug Logging
- Added `console.log("[WebSocket Attempting Connection to]:", url)` before `new WebSocket(url)` at line ~179
- Allows quick verification in Browser DevTools Console of which URL is being targeted

#### 4. Removed `NEXT_PUBLIC_API_URL` derivation from `getWsUrl()`
- The old code derived WS URL from `NEXT_PUBLIC_API_URL` (step 2 in old priority). This is no longer needed because:
  - Localhost connects directly to backend (step 2 above)
  - Tunnel uses `window.location.host` (step 3 above)
  - If user needs custom WS URL, they set `NEXT_PUBLIC_WS_URL` (step 1)

### Files Changed

| File | Action | Description |
|------|--------|-------------|
| `neuropulse-ai/middleware.ts` | **Deleted** | Next.js Edge Middleware can't proxy WebSocket upgrade streams |
| `neuropulse-ai/hooks/useWebSocketStream.ts` | Modified | Rewrote `getWsUrl()` โ€” localhost direct connection, tunnel wss://, debug console.log |
| `PROJECT_LOG.md` | Updated | This log |

### Connection Flow (After Fix)

```
Local Development (localhost:3000):
  Browser โ’ ws://127.0.0.1:8765/ws/eeg-stream  (direct, bypasses Next.js)
            โ“
  Backend FastAPI /ws/eeg-stream โ’ connected โ…

Cloudflare Tunnel (https://abc.trycloudflare.com):
  Browser โ’ wss://abc.trycloudflare.com/ws/eeg-stream
            โ“
  Cloudflare Tunnel โ’ forwards to localhost:3000/ws/eeg-stream
            โ“
  Next.js rewrites โ’ http://127.0.0.1:8765/ws/eeg-stream
            โ“
  Backend FastAPI /ws/eeg-stream โ’ connected โ…
```

---

### 2026-08-06T05:00+07:00 โ€” WebSocket "Closed Before Connection Established" Root Cause

#### 1. Root Cause: `EEGProvider` Used `localhost` (IPv6 `::1`)
- **File**: `neuropulse-ai/hooks/useEEGContext.tsx` (line 104)
- **Problem**: `EEGProvider` (root layout, active on ALL pages) used hardcoded fallback `ws://localhost:8765/ws/eeg-stream`. On Windows, `localhost` can resolve to IPv6 `::1`, but the backend binds to IPv4 `127.0.0.1` only. Browser connects to `ws://[::1]:8765` โ’ TCP fails โ’ "WebSocket is closed before the connection is established."
- **Fix**: Changed fallback to `ws://127.0.0.1:8765/ws/eeg-stream`. Also checks `process.env.NEXT_PUBLIC_WS_URL` first so `.env.local` takes priority.
- **Code change**:
  ```diff
  - const url = wsUrl ?? "ws://localhost:8765/ws/eeg-stream";
  + const url = wsUrl ?? process.env.NEXT_PUBLIC_WS_URL ?? "ws://127.0.0.1:8765/ws/eeg-stream";
  ```

#### 2. Removed `/ws/*` Rewrite from `next.config.js`
- **File**: `neuropulse-ai/next.config.js`
- **Problem**: Next.js `async rewrites()` does NOT handle WebSocket upgrade headers (`Upgrade: websocket`, `Connection: Upgrade`). The `/ws/*` rewrite rule could interfere if any request ever hits the Next.js dev server first.
- **Fix**: Removed the `/ws/:path*` rewrite rule. Only `/api/*` REST proxy remains. Frontend connects directly to `ws://127.0.0.1:8765/ws/eeg-stream`.

#### 3. Eliminated Duplicate WebSocket Connections
- **Files**: `useEEGContext.tsx` (provider), `useWebSocketStream.ts` (hook)
- **Problem**: Two WebSocket connections competed:
  1. `EEGProvider` (root layout) โ€” manages actual WS connection
  2. `useWebSocketStream` (dashboard page) โ€” created a **second** independent WS connection
  - Both sent/received the same data, causing race conditions.
  - `useWebSocketStream`'s cleanup called `socketRef.current?.close()` even during CONNECTING state, tearing down connections mid-handshake.
- **Fix**: `useWebSocketStream` refactored to a **thin adapter** that reads from `useEEGContext`. Single source of truth is `EEGProvider`. Hook returns compatible `{ url, connectionState, sample, lastError, connect, disconnect }` interface.

#### 4. Fixed Rules of Hooks Violation in `DashboardShell.tsx`
- **Problem**: `useState` for `brainprintStatus` was called **after** two early `return` statements (`isLoading` check, auth redirect). Error log showed hook order mismatch between renders.
- **Fix**: Moved `useState<BrainprintStatus>("idle")` to the **top** of the component, before all conditional returns.

#### 5. Suppressed Chrome Extension Hydration Warning
- **File**: `neuropulse-ai/app/layout.tsx`
- **Problem**: Chrome extensions inject `cz-shortcut-listen` attribute on `<body>`, causing React hydration mismatch warning.
- **Fix**: Added `suppressHydrationWarning` to `<body>`. (Note: this is cosmetic โ€” extensions can inject arbitrary attributes that React can't control.)

### Files Changed

| File | Action | Description |
|------|--------|-------------|
| `neuropulse-ai/.env.local` | Modified | Set explicit `NEXT_PUBLIC_WS_URL=ws://127.0.0.1:8765/ws/eeg-stream` |
| `neuropulse-ai/hooks/useEEGContext.tsx` | Modified | Fixed fallback URL: `localhost` โ’ `127.0.0.1`, added env var check |
| `neuropulse-ai/next.config.js` | Modified | Removed `/ws/*` rewrite rule |
| `neuropulse-ai/hooks/useWebSocketStream.ts` | Rewritten | Thin adapter reading from `useEEGContext` โ€” no duplicate WS |
| `neuropulse-ai/components/layout/DashboardShell.tsx` | Modified | Moved `useState` above conditional returns (Rules of Hooks) |
| `neuropulse-ai/app/layout.tsx` | Modified | Added `suppressHydrationWarning` to `<body>` |
| `PROJECT_LOG.md` | Updated | This log |

---

### 2026-08-06T04:45+07:00 โ€” Rules of Hooks Fix, WebSocket Dedup, Hydration Warning

#### 1. Fixed Rules of Hooks Violation in `DashboardShell.tsx`
- **File**: `neuropulse-ai/components/layout/DashboardShell.tsx`
- **Problem**: `useState` (for `brainprintStatus`) was called **after** two early `return` statements (`isLoading` check, auth redirect). React requires hooks to be called in the same order every render. The error log showed:
  ```
  Previous render            Next render
  ------------------------------------------------------
  1. useContext             useContext
  2. useContext             useContext
  3. useContext             useContext
  4. undefined              useState
  ```
- **Fix**: Moved `useState<BrainprintStatus>("idle")` to the **top** of the component, before all conditional returns. Now all hooks are called in the same order regardless of early returns.

#### 2. Eliminated Duplicate WebSocket Connections
- **Files**: `neuropulse-ai/hooks/useEEGContext.tsx` (provider), `neuropulse-ai/hooks/useWebSocketStream.ts` (hook)
- **Problem**: Two separate WebSocket connections were created:
  1. `EEGProvider` (root layout) โ€” manages the actual WS connection, provides `latestSample`, `metrics`, `connectionLabel`
  2. `useWebSocketStream` (dashboard page via `useDataSource`) โ€” created a **second** independent WS connection
  - Both connections competed for the same backend port, causing race conditions and "WebSocket closed before connection established" errors.
  - `useWebSocketStream`'s cleanup called `socketRef.current?.close()` even during CONNECTING state, tearing down connections mid-handshake.
- **Fix**: `useWebSocketStream` was refactored to a **thin adapter** that reads from `useEEGContext` instead of creating its own connection. The single source of truth is now `EEGProvider`. The hook returns a compatible `{ url, connectionState, sample, lastError, connect, disconnect }` interface so downstream components (`ConnectionStatusWidget`, `useDataSource`, etc.) work without changes.
- **Note**: `suppressHydrationWarning` was added to `<body>` in `layout.tsx` to suppress Chrome extension `cz-shortcut-listen` hydration warning. This is a cosmetic fix โ€” the warning comes from Chrome extensions injecting attributes on `<body>`, which Next.js can't fully prevent.

### Files Changed

| File | Action | Description |
|------|--------|-------------|
| `neuropulse-ai/components/layout/DashboardShell.tsx` | Modified | Moved `useState` above conditional returns (Rules of Hooks) |
| `neuropulse-ai/hooks/useWebSocketStream.ts` | Rewritten | Thin adapter reading from `useEEGContext` โ€” no duplicate WS |
| `neuropulse-ai/app/layout.tsx` | Modified | Added `suppressHydrationWarning` to `<body>` |
| `PROJECT_LOG.md` | Updated | This log |

---

### 2026-08-06T12:00+07:00 โ€” Claude Code Agent Skills Created

#### 1. Created 6 Claude Code agent skill files in `.claude/agents/`

These skills give any AI collaborator (Claude, Copilot, etc.) deep context about the NeuroPulse codebase before starting work.

| # | Skill | File | Description |
|---|-------|------|-------------|
| 1 | `frontend-development` | `.claude/agents/frontend-development.md` | Next.js 14, React, TypeScript, Tailwind CSS โ€” pages, hooks, components, data flow |
| 2 | `backend-development` | `.claude/agents/backend-development.md` | FastAPI, Python, SQLite, Pydantic โ€” endpoints, database, services, config |
| 3 | `eeg-signal-processing` | `.claude/agents/eeg-signal-processing.md` | Signal filtering, Welch PSD, band power, biomarkers (focus/stress/relax), embedding vectors |
| 4 | `brainprint-ml` | `.claude/agents/brainprint-ml.md` | Biometric ML โ€” cosine similarity + Mahalanobis distance, Random Forest brain state model |
| 5 | `websocket-debugging` | `.claude/agents/websocket-debugging.md` | WebSocket connection, heartbeat PING/PONG, auto-reconnect, localhost vs 127.0.0.1 |
| 6 | `fullstack-integration` | `.claude/agents/fullstack-integration.md` | Data contracts, API endpoint reference, data flow map, config alignment |

#### 2. Created Memory Index

- **Created**: `memory/MEMORY.md` โ€” index file linking all 6 skills + 1 reference memory

#### 3. Key Files Reviewed to Build Skills

All critical source files were read and distilled into the skill definitions:

| File | Skill(s) Covered |
|------|-----------------|
| `neuropulse-ai/lib/types.ts` | frontend-development, fullstack-integration |
| `neuropulse-backend/schemas.py` | backend-development, fullstack-integration |
| `neuropulse-backend/main.py` | backend-development, fullstack-integration, websocket-debugging |
| `neuropulse-backend/services/feature_extractor.py` | eeg-signal-processing |
| `neuropulse-backend/services/brainprint_ml.py` | brainprint-ml |
| `neuropulse-backend/services/qwen_service.py` | backend-development |
| `neuropulse-backend/db/database.py` | backend-development |
| `neuropulse-ai/hooks/useEEGContext.tsx` | frontend-development, websocket-debugging |
| `neuropulse-ai/hooks/useDataSource.ts` | frontend-development, fullstack-integration |
| `CLAUDE.md` | All skills (project overview) |
| `PROJECT_LOG.md` | All skills (debugging history, known issues) |
| `AI_INSTRUCTIONS.md` | All skills (collaborator rules) |

#### 4. Skill Design Principles

- **No duplicate content** โ€” skills reference the codebase, don't re-copy it
- **Critical rules extracted** โ€” localhost vs 127.0.0.1, single WS connection, no hardcoded URLs
- **API contracts documented** โ€” request/response shapes in both skill and fullstack-integration
- **Debugging history preserved** โ€” WebSocket fixes, Rules of Hooks, hydration warnings all captured
- **Biomarker formulas explicit** โ€” focus/stress/relax formulas in eeg-signal-processing skill
- **Verification logic documented** โ€” cosine + Mahalanobis two-metric system in brainprint-ml skill

### Files Changed

| File | Action | Description |
|------|--------|-------------|
| `.claude/agents/frontend-development.md` | Created | Next.js frontend skill โ€” pages, hooks, components, data flow |
| `.claude/agents/backend-development.md` | Created | FastAPI backend skill โ€” endpoints, database, services, config |
| `.claude/agents/eeg-signal-processing.md` | Created | Signal processing skill โ€” filtering, band power, biomarkers |
| `.claude/agents/brainprint-ml.md` | Created | Brainprint ML skill โ€” matching algorithms, training pipeline |
| `.claude/agents/websocket-debugging.md` | Created | WebSocket skill โ€” connection, heartbeat, proxy patterns |
| `.claude/agents/fullstack-integration.md` | Created | Full-stack skill โ€” data contracts, API reference, flow map |
| `memory/MEMORY.md` | Created | Memory index โ€” links all skills + reference memories |
| `PROJECT_LOG.md` | Updated | This log |

### Next Steps / Warnings

1. **Test skills** โ€” invoke each skill to verify it loads correctly and provides useful context
2. **Add more memories** โ€” as bugs/features are discovered, add them to `memory/` and update `MEMORY.md`
3. **Skill refinement** โ€” skills may need updates as the codebase evolves
4. **AI collaborator adoption** โ€” any AI tool can now read these skills before starting work (per `AI_INSTRUCTIONS.md` rules)

---

---

### 2026-08-06T12:30+07:00 โ€” WebSocket Heartbeat Fix: Frontend PING/PONG Added

#### 1. Problem: Backend Disconnecting Clients Immediately
- **Backend Log**: `WARNING:neuropulse.main:Client unresponsive โ€” disconnecting`
- **Root Cause**: Backend `eeg_stream()` in `main.py` has a heartbeat mechanism that sends PING every 15s and disconnects after 3 missed responses (45s). However, the frontend in `useEEGContext.tsx` had **no heartbeat** โ€” no PING sent, no PONG received. The backend's `missed_heartbeats` counter would increment until it exceeded `HEARTBEAT_MAX_MISSED (3)`, triggering the disconnect.
- **Why it happened**: When WebSocket code was refactored from `useWebSocketStream.ts` into `useEEGContext.tsx` (EEGProvider), the heartbeat (ping/pong) system that existed in the old `useWebSocketStream.ts` was **not carried over**.

#### 2. Fix: Added Heartbeat to `useEEGContext.tsx`

**Changes**:

1. **Added `pingIntervalRef`** โ€” stores the `setInterval` ID for cleanup:
   ```ts
   const pingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
   ```

2. **Start heartbeat in `ws.onopen`** โ€” fires every 15s while `ws.readyState === WebSocket.OPEN`:
   ```ts
   pingIntervalRef.current = setInterval(() => {
     if (ws.readyState === WebSocket.OPEN) {
       ws.send(JSON.stringify({ type: "ping" }));
     }
   }, 15000);
   ```

3. **Handle incoming PING in `ws.onmessage`** โ€” respond with plain-text `"PONG"`:
   ```ts
   if (event.data === "PING") {
     ws.send("PONG");
     return;
   }
   ```

4. **Cleanup on unmount** โ€” `clearInterval` in the `useEffect` cleanup:
   ```ts
   pingIntervalRef.current && clearInterval(pingIntervalRef.current);
   ```

#### 3. Backend Heartbeat Configuration (No Changes Needed)

Backend `main.py` heartbeat config is consistent:

| Config | Value | Meaning |
|--------|-------|---------|
| `HEARTBEAT_INTERVAL_S` | `15.0` | Send PING every 15s |
| `HEARTBEAT_MAX_MISSED` | `3` | Disconnect after 3 missed (45s total) |

Backend accepts **both** plain-text `"PONG"` and JSON `{"type": "pong"}` โ€” our frontend sends `{"type": "ping"}` (outbound) and `"PONG"` (inbound response), both are handled correctly.

#### 4. Timing Summary

```
Backend:  [PING] --15s--> [PING] --15s--> [PING] --15s--> DISCONNECT
Frontend:   โPONG       โPONG       โPONG       (if no PONG received)

Frontend: [PING] --15s--> [PING] --15s--> [PING] ... (keeps alive)
            โ’ping         โ’ping         โ’ping
            โPONG         โPONG         โPONG
```

Both sides now send/receive heartbeats on matching 15s intervals. Connection should stay alive indefinitely.

### Files Changed

| File | Action | Description |
|------|--------|-------------|
| `neuropulse-ai/hooks/useEEGContext.tsx` | Modified | Added heartbeat: outbound PING every 15s + inbound PONG handler + cleanup |
| `PROJECT_LOG.md` | Updated | This log |

### Next Steps / Warnings

1. **Test**: Restart backend + frontend, verify no more "Client unresponsive" warnings in backend logs
2. **Monitor**: Check that WebSocket stays connected during idle periods (no data flowing for >45s)
3. **Consider**: Adding a heartbeat status indicator to the UI (similar to the one in `WebSocketPanel.tsx`) so users can see connection health

---

### 2026-08-06T15:45+07:00 โ€” Dashboard Stuck on "Disconnected": isUnmountedRef Never Reset

#### 1. Problem: UI Frozen on "Disconnected" / "Backend unreachable"
- **Symptom**: Dashboard shows `Disconnected` status and the red banner
  `Backend unreachable โ€” is it running on port 8765?`. Blue "Connect" button
  does nothing. Browser console: `WebSocket is closed before the connection
  is established.`
- **Ruled out first**: `.env.local` (`NEXT_PUBLIC_WS_URL=ws://127.0.0.1:8765/ws/eeg-stream`)
  is correct โ€” not a `localhost`/IPv6 issue. Backend heartbeat logic in
  `main.py` is also correct in isolation.

#### 2. Root Cause: `isUnmountedRef` Set True in Cleanup, Never Reset on Remount
- **File**: `neuropulse-ai/hooks/useEEGContext.tsx`
- React 18 Strict Mode (default in `next dev`) runs
  `effect โ’ cleanup โ’ effect` on every mount. The cleanup set
  `isUnmountedRef.current = true` but nothing ever set it back to `false`
  on the second (real) mount. Every subsequent `ws.onopen` / `ws.onclose`
  handler starts with `if (isUnmountedRef.current) return;`, so once the
  ref got stuck at `true`, the socket could connect and stream data
  perfectly fine underneath, but `setWsReadyState(OPEN)` was never called โ€”
  the UI stayed on `Disconnected` forever. Auto-reconnect was silently
  dead for the same reason (`onclose` also short-circuited).
- The `CONNECTING`-safe close guard added in the previous heartbeat fix
  (checking `readyState` before calling `.close()` on unmount) was already
  correct and is not the cause of the console error โ€” the actual bug was
  one layer up, in the stale ref.

#### 3. Fix
- **`useEEGContext.tsx`**: reset `isUnmountedRef.current = false` at the
  top of the mount effect (not only `true` in the cleanup).
- **`useEEGContext.tsx`**: `wsReadyState` is now set to `WebSocket.CONNECTING`
  immediately after `new WebSocket(url)`, so the label shows
  `Connecting...` during the handshake instead of staying on `Disconnected`
  until `onopen` fires.
- **`useEEGContext.tsx`**: added real `reconnect()` and `disconnect()`
  functions to `EEGContextValue` โ€” `reconnect()` clears any pending backoff
  timer, resets the attempt counter, and opens a fresh socket immediately;
  `disconnect()` pauses auto-reconnect and closes (or cancels) the socket.
- **`useWebSocketStream.ts`**: `connect` / `disconnect` were no-op stubs
  (`() => {}`) โ€” this is why the blue Connect button did nothing. Wired
  both to `eegCtx.reconnect` / `eegCtx.disconnect`.

### Files Changed

| File | Action | Description |
|------|--------|-------------|
| `neuropulse-ai/hooks/useEEGContext.tsx` | Modified | Reset `isUnmountedRef` on mount, set `CONNECTING` state on socket creation, added `reconnect()`/`disconnect()` |
| `neuropulse-ai/hooks/useWebSocketStream.ts` | Modified | Wired `connect`/`disconnect` to real context methods instead of no-op stubs |
| `PROJECT_LOG.md` | Updated | This log |

### Next Steps / Warnings

1. **Test**: Run `npm run dev` (Strict Mode on) and confirm the Dashboard reaches `Streaming` on first load, without needing a manual refresh.
2. **Test**: Click Connect/Disconnect and confirm the socket actually opens/closes each time.
3. **Watch for regressions**: any future refactor of `useEEGContext.tsx`'s mount effect should keep the `isUnmountedRef.current = false` reset paired with the `= true` in cleanup โ€” one without the other reintroduces this exact bug.

---

*This log is auto-maintained by AI collaborators. See `AI_INSTRUCTIONS.md` for rules.*

---

### 2026-08-06T16:00+07:00 โ€” WebSocket Infinite Connect-Disconnect Loop: React Reference Loop

#### 1. Problem: Infinite `mount โ’ cleanup โ’ mount` Loop

- **Symptom**: Browser console floods with:
  ```
  [EEGProvider] mount effect firing, url = ws://127.0.0.1:8765/ws/eeg-stream
  [EEGProvider] cleanup firing (unmount or doConnect changed)
  [EEGProvider] mount effect firing, url = ws://127.0.0.1:8765/ws/eeg-stream
  [EEGProvider] ws.onclose โ€” code: 1005 reason: "" wasClean: true
  ```
  Backend terminal shows connect/disconnect with new port every cycle (54211โ’62473โ’49688...).
  Loop persists even when backend is stopped โ€” proving it's frontend self-inflicted.

- **Root Cause**: `useEffect` dependency array `[doConnect]` in `useEEGContext.tsx` line 260.
  `doConnect` is a `useCallback` inside the component โ€” **React creates a new function reference
  on every render** (even though its internal dependency `[url]` never changes). The effect sees
  `[doConnect]` as "changed" on every render โ’ runs โ’ cleanup tears down socket โ’ body creates new socket
  โ’ state update triggers re-render โ’ `doConnect` is a new reference โ’ effect re-runs โ’ infinite loop.

  This is a classic React gotcha: `useCallback` with stable internal deps does NOT guarantee a stable
  reference when used as a dependency of a parent effect. The function object itself is new each render.

#### 2. Fix: Stable Reference Pattern + Empty Dependency Array

**Changes in `useEEGContext.tsx`**:

1. **Added `doConnectRef`** โ€” a `useRef` that holds a stable reference to the latest `doConnect`:
   ```ts
   const doConnectRef = useRef<() => void>();
   useEffect(() => { doConnectRef.current = doConnect; }, [doConnect]);
   ```

2. **Changed `useEffect` dependency from `[doConnect]` to `[]`** โ€” `doConnect` captures everything
   it needs via closures (`url`, `socketRef`, `isUnmountedRef`, etc.), so it doesn't need to be a
   dependency. The empty array ensures the effect runs exactly once on mount.

3. **Changed `reconnect` callback** to use `doConnectRef.current?.()` with `[]` dependency instead of
   `doConnect()` with `[doConnect]` dependency โ€” prevents the same loop in the manual reconnect action.

4. **Removed all TEMP DEBUG console.log statements** โ€” cleaned up `[EEGProvider]` prefixed logs from
   `onclose` handler, mount effect, and cleanup function.

**Code changes**:
```diff
  const pingIntervalRef = useRef<...>(null);
+ const doConnectRef = useRef<() => void>();

  const doConnect = useCallback(() => { ... }, [url]);

+ useEffect(() => { doConnectRef.current = doConnect; }, [doConnect]);

  useEffect(() => {
-   console.log("[EEGProvider] mount effect firing, url =", url);
    isUnmountedRef.current = false;
    doConnect();
    return () => {
-     console.log("[EEGProvider] cleanup firing (unmount or doConnect changed)");
      isUnmountedRef.current = true;
      ...
    };
- }, [doConnect]);
+ }, []);

  ws.onclose = (event: CloseEvent) => {
-   // TEMP DEBUG console.log
-   console.log("[EEGProvider] ws.onclose โ€” code:", event.code, ...);
    if (isUnmountedRef.current) return;
    ...
  };

  const reconnect = useCallback(() => {
    ...
-   doConnect();
+   doConnectRef.current?.();
- }, [doConnect]);
+ }, []);
```

### Files Changed

| File | Action | Description |
|------|--------|-------------|
| `neuropulse-ai/hooks/useEEGContext.tsx` | Modified | Fixed infinite loop: `doConnect` ref pattern, `[]` dependency, removed debug logs |
| `PROJECT_LOG.md` | Updated | This log |

### Next Steps / Warnings

1. **Test**: Restart frontend (`npm run dev`), verify WebSocket connects once and stays connected.
2. **Test**: Navigate between pages (dashboard, brainprint, analytics, ai-consultant) โ€” connection should persist.
3. **Test**: Click Connect/Disconnect button โ€” should work correctly.
4. **Monitor**: No more `[EEGProvider]` flood in browser console (only 1 mount + 1 cleanup from StrictMode).
5. **Prevention**: When adding new `useCallback` deps, always verify the reference is stable โ€” if a callback
   lives inside a component, prefer the ref pattern over using it as a dependency.

---

### 2026-08-06T16:30+07:00 โ€” WebSocket Auto-Reconnect Disabled: Connect Only on Page Refresh

#### 1. Problem: Infinite Connect-Disconnect Loop Persists After Reference Fix

- **Symptom**: Even after fixing the React reference loop (empty `[]` dependency array + `doConnectRef`),
  the WebSocket still reconnects infinitely when disconnected. Browser console shows repeated
  `ws.onclose` โ’ `setTimeout(doConnect, delay)` โ’ `doConnect()` โ’ new WebSocket โ’ disconnect โ’ repeat.
  Backend terminal shows connect/disconnect cycles with new port every cycle.

- **Root Cause**: The `ws.onclose` handler in `useEEGContext.tsx` contained auto-reconnect logic with
  exponential backoff:
  ```ts
  ws.onclose = (event: CloseEvent) => {
    if (isUnmountedRef.current) return;
    setWsReadyState(WebSocket.CLOSED);
    if (autoReconnectRef.current && reconnectAttemptsRef.current < maxReconnectAttempts) {
      const delay = Math.min(1000 * Math.pow(1.5, reconnectAttemptsRef.current), 10000);
      reconnectAttemptsRef.current += 1;
      reconnectTimerRef.current = setTimeout(() => {
        doConnect();  // โ auto-reconnect
      }, delay);
    }
  };
  ```
  When the WebSocket disconnects (for any reason โ€” backend restart, network issue, StrictMode cleanup),
  this handler schedules `doConnect()` with exponential backoff (1.5s โ’ 2.25s โ’ 3.375s โ’ ... up to 10s).
  This creates an infinite reconnect loop that persists even after the backend is stopped.

- **User Request**: "เน€เธเธฅเธตเนเธขเธเน€เธเนเธฏเนเธซเนเธกเธฑเธ reconnect เน€เธเธเธฒเธฐเธ•เธญเธเน€เธงเนเธเนเธเธ•เน refresh เนเธ”เนเธกเธฑเนเธข" โ€” user wants WebSocket
  to only connect on initial mount (page refresh), NOT auto-reconnect on disconnect.

#### 2. Fix: Removed Auto-Reconnect from `ws.onclose` Handler

**Before**:
```ts
ws.onclose = (event: CloseEvent) => {
  if (isUnmountedRef.current) return;
  setWsReadyState(WebSocket.CLOSED);
  if (autoReconnectRef.current && reconnectAttemptsRef.current < maxReconnectAttempts) {
    const delay = Math.min(1000 * Math.pow(1.5, reconnectAttemptsRef.current), 10000);
    reconnectAttemptsRef.current += 1;
    reconnectTimerRef.current = setTimeout(() => {
      doConnect();
    }, delay);
  }
};
```

**After**:
```ts
ws.onclose = (event: CloseEvent) => {
  if (isUnmountedRef.current) return;
  setWsReadyState(WebSocket.CLOSED);
};
```

**Behavior after fix**:
- **Page refresh / initial mount** โ’ mount effect runs โ’ `doConnect()` โ’ WebSocket opens
- **Disconnect** (backend stops, network issue) โ’ `onclose` fires โ’ sets state to CLOSED โ’ **no auto-reconnect**
- **Manual reconnect** โ’ user clicks UI button โ’ `reconnect()` callback โ’ `doConnectRef.current?.()` โ’ fresh connection

**Unused code left in place** (no functional impact):
- `reconnectTimerRef`, `reconnectAttemptsRef`, `maxReconnectAttempts` โ€” only used by removed auto-reconnect
- `autoReconnect` state + `setAutoReconnect` โ€” only used by removed auto-reconnect toggle
- `autoReconnectRef` โ€” only checked by removed auto-reconnect logic

These can be cleaned up in a future refactor if desired.

### Files Changed

| File | Action | Description |
|------|--------|-------------|
| `neuropulse-ai/hooks/useEEGContext.tsx` | Modified | Removed auto-reconnect from `ws.onclose` handler โ€” connect only on page refresh |
| `PROJECT_LOG.md` | Updated | This log |

### Next Steps / Warnings

1. **Test**: Restart frontend, verify WebSocket connects once on mount.
2. **Test**: Stop backend โ€” WebSocket should go to CLOSED and stay there (no reconnect attempts).
3. **Test**: Refresh page โ€” WebSocket should reconnect (new mount โ’ new connection).
4. **Test**: Manual reconnect button โ€” should still work via `reconnect()` callback.
5. **Warning**: If backend restarts while frontend is on, the WebSocket will NOT auto-recover.
   User must refresh the page to reconnect. This is intentional per user request.

---

### 2026-08-06T17:00+07:00 โ€” AI Consultant 401 Unauthorized Fix: Static SECRET_KEY + Absolute .env Path

#### 1. Problem: `GET /api/qwen-chat/history` โ’ 401 Unauthorized

- **Symptom**: AI Consultant page shows "Not authenticated. Please log in." even when user is logged in.
  Browser console: `api/qwen-chat/history:1 Failed to load resource: the server responded with a status of 401 (Unauthorized)`
- **Root Cause**: Two issues:
  1. `.env` loading used `str(Path(...))` which worked but was inconsistent โ€” changed to explicit `dotenv_path=` parameter for clarity and reliability.
  2. `SECRET_KEY` was hardcoded differently in `.env` (`[REDACTED-SECRET]`) vs the default in `main.py` (`[REDACTED-SECRET]`). If `.env` failed to load (wrong working directory, missing file), the fallback key wouldn't match the token issued by a previous server instance.

#### 2. Fix: Static SECRET_KEY + Absolute .env Path

**Changes in `main.py`**:

1. **`.env` loading** โ€” use explicit `dotenv_path=` parameter:
   ```diff
   - load_dotenv(str(Path(__file__).parent / ".env"))
   + load_dotenv(dotenv_path=Path(__file__).parent / ".env")
   ```

2. **`SECRET_KEY`** โ€” use a fixed static value (never random, never changes between restarts):
   ```diff
   - SECRET_KEY = os.getenv("SECRET_KEY", "[REDACTED-SECRET]")
   + SECRET_KEY = os.getenv("SECRET_KEY", "[REDACTED-SECRET]")
   ```

3. **Removed `import secrets`** โ€” was not used in the file (verified clean).

**Changes in `.env` and `.env.example`**:

- Set `SECRET_KEY=[REDACTED-SECRET]` in both files to match the default in `main.py`.
- `.env.example` now shows the actual production-static key instead of `change-me-to-a-random-string`.

#### 3. Why Static SECRET_KEY?

- JWT tokens are signed with `SECRET_KEY`. If the key changes between server restarts, **all existing tokens become invalid** โ€” users get logged out.
- A static key ensures tokens remain valid across hot-reloads (uvicorn `--reload`) and server restarts.
- This is safe for development/prototype. For production, set a real random key in `.env` and **never commit it** to git.

### Files Changed

| File | Action | Description |
|------|--------|-------------|
| `neuropulse-backend/main.py` | Modified | Fixed `.env` loading (`dotenv_path=`), static `SECRET_KEY` |
| `neuropulse-backend/.env` | Modified | Updated `SECRET_KEY` to `[REDACTED-SECRET]` |
| `neuropulse-backend/.env.example` | Modified | Updated `SECRET_KEY` to `[REDACTED-SECRET]` |
| `PROJECT_LOG.md` | Updated | This log |

### Next Steps / Warnings

1. **Restart backend**: `uvicorn main:app --reload --port 8765`
2. **Login again**: Log out โ’ Log in to get a fresh JWT token with the new static key
3. **Test AI Consultant**: Navigate to /ai-consultant, send a message โ€” should work without 401
4. **Production**: Set a real random `SECRET_KEY` in `.env` before deploying โ€” never use the static default in production

---

### 2026-08-09+07:00 โ€” Brainprint CORS Bug Fix: Root Cause Corrected + End-to-End Verification

#### 1. ROOT CAUSE REVISION: CORSMiddleware headers stripped by DynamicCorsMiddleware

- **Files**: `neuropulse-backend/main.py` (DynamicCorsMiddleware, _verify_db_integrity)
- **Original theory (WRONG)**: "Unhandled exceptions in brainprint routes dropped CORS headers." This was plausible but incorrect โ€” the exception handler fix was added but the CORS problem persisted because it was a **middleware stack ordering issue**, not an exception-handling issue.
- **Actual root cause**: `DynamicCorsMiddleware` was implemented as a subclass of `BaseHTTPMiddleware` (the sync wrapper). `BaseHTTPMiddleware` converts ASGI responses to a WSGI-style response and **strips all headers** that were added by middleware underneath it in the stack. Since `DynamicCorsMiddleware` was added *after* `CORSMiddleware`, it became the outermost layer and its response object had no CORS headers to carry through. The browser received responses without `Access-Control-Allow-Origin` โ€” not because of CORS misconfiguration, but because the outermost middleware silently dropped them.
- **Fix**: Rewrote `DynamicCorsMiddleware` as a native ASGI middleware (`__init__(self, app)` + `__call__(self, scope, receive, send)`) that preserves headers from inner middleware and only injects tunnel-specific headers when needed. Also added `conn.row_factory = sqlite3.Row` to `_verify_db_integrity()` so the DB integrity check no longer crashes (was showing `DATABASE_PATH` error in startup logs).

#### 2. ROOT CAUSE: brainprint_profiles DB schema mismatch

- **File**: `neuropulse-backend/db/database.py` (init_db migration)
- **Problem**: The SCHEMA string correctly defines `user_id INTEGER NOT NULL` on `brainprint_profiles` (line 37), but the existing `brainprint.db` file was created on a different machine **before** that column existed. `init_db()` uses `CREATE TABLE IF NOT EXISTS` โ€” it does not alter existing tables. So the query `SELECT user_id FROM brainprint_profiles` failed with `no such column: user_id`.
- **Fix**: Added a post-init migration in `init_db()` that detects the missing column, creates a fresh table with the correct schema, re-inserts existing rows with `user_id=1` (single-user prototype), and logs the migration.

#### 3. End-to-End Verification โ€” 2026-08-09

| Endpoint | Status | CORS Headers | Body |
|----------|--------|-------------|------|
| `GET /health` (Origin: http://localhost:3000) | 200 OK | โ… `access-control-allow-origin: http://localhost:3000`, `access-control-allow-credentials: true`, `vary: Origin` | `{"status":"ok","qwen_configured":true,"startup":{"db":"ok","db_tables":{"users":"ok","chat_messages":"ok","brainprint_profiles":"ok"},"model":"not_loaded","qwen":"configured"}}` |
| `GET /api/brainprint/profiles` (Origin: http://localhost:3000, Bearer token) | 200 OK | โ… Same CORS headers | `[]` (empty array โ€” no profiles enrolled yet, but endpoint works) |

- **CORS allow_origins configured**: `http://localhost:3000`, `http://127.0.0.1:3000`, `ws://localhost:3000`, `ws://127.0.0.1:3000`, plus ngrok/cloudflare tunnel regex patterns
- **DB migration**: `brainprint_profiles` missing `user_id` column โ€” migrated successfully at startup
- **Startup status**: `db: ok`, all tables present, `model: not_loaded` (sklearn missing โ€” known follow-up)

#### 4. Supporting Fixes (unchanged from original)
- Added startup checks for required database tables/files/models in `main.py`.
- Enhanced `/health` endpoint with readiness checks (startup status, Qwen config, model status).
- Created `lib/fetchWithHealth.ts` โ€” shared `apiFetch()` wrapper that distinguishes network failures from HTTP error statuses.
- Converted `BrainprintView.tsx`, `AIChatInterface.tsx`, and `useAuth.tsx` to use `apiFetch()`.

#### 5. Verification โ€” Remaining fetch() Audit
- Searched all source files (`lib/`, `hooks/`, `app/api/`, `components/`) for raw `fetch()` calls targeting the backend.
- **Result**: No remaining raw `fetch()` calls to backend URLs outside the three converted files. The only `fetch()` calls in `lib/` are inside `fetchWithHealth.ts` itself (the wrapper โ€” correct).

#### 6. Verification โ€” TypeScript Check
- Ran `npx tsc --noEmit` after the refactor.
- **Errors found**: `apiFetch<T = unknown>` returns `unknown` by default, causing TS2339/TS18046 errors in `useAuth.tsx` (16 errors on `data`/`loginData` property access) and `qwenApiHandler.ts` (3 errors on `data` property access).
- **Fix**: Added explicit type parameters to all `apiFetch()` calls:
  - `useAuth.tsx`: `apiFetch<{ access_token: string; token_type: string; user_id: number; email: string; nickname: string; created_at: string }>` for all 3 auth calls
  - `qwenApiHandler.ts`: `apiFetch<{ reply: string; flagged_markers?: string[]; latency_ms?: number }>` for qwen-chat call

### Files Changed

| File | Action | Description |
|------|--------|-------------|
| `neuropulse-backend/main.py` | Modified | Rewrote DynamicCorsMiddleware as native ASGI, added CORS startup logging, fixed _verify_db_integrity row_factory, imported DATABASE_PATH |
| `neuropulse-backend/db/database.py` | Modified | Added post-init migration for brainprint_profiles user_id column, added logging import |
| `neuropulse-ai/lib/fetchWithHealth.ts` | Created | Shared `apiFetch()` wrapper with network/HTTP error distinction |
| `neuropulse-ai/components/brainprint/BrainprintView.tsx` | Modified | Converted raw fetch() โ’ apiFetch() |
| `neuropulse-ai/components/ai/AIChatInterface.tsx` | Modified | Converted raw fetch() โ’ apiFetch() |
| `neuropulse-ai/hooks/useAuth.tsx` | Modified | Converted raw fetch() โ’ apiFetch() + added type params + AuthResponse interface |
| `neuropulse-ai/lib/qwenApiHandler.ts` | Modified | Added type param to apiFetch() call |
| `PROJECT_LOG.md` | Updated | This log |

### Next Steps / Warnings

1. **TypeScript**: All `apiFetch` calls now have explicit type parameters. Future `apiFetch()` calls must include a type param to avoid TS18046 errors.
2. **No other raw fetch() calls exist** in the codebase targeting the backend โ€” the migration is complete.
3. **Known follow-up**: `sklearn` not installed โ€” brain-state ML model from training pipeline won't load on this machine. Backend falls back to biomarker-only mode for the WebSocket stream. Install `scikit-learn` if model prediction is needed.

---

### 2026-08-09+07:00 โ€” CORS Middleware Fix + DB Schema Migration + End-to-End Verification

#### 1. ROOT CAUSE REVISION: CORSMiddleware headers stripped by DynamicCorsMiddleware

- **Original theory (WRONG)**: "Unhandled exceptions in brainprint routes dropped CORS headers." This was plausible but incorrect โ€” the exception handler fix was added but the CORS problem persisted because it was a **middleware stack ordering issue**, not an exception-handling issue.
- **Actual root cause**: `DynamicCorsMiddleware` was implemented as a subclass of `BaseHTTPMiddleware` (the sync wrapper). `BaseHTTPMiddleware` converts ASGI responses to a WSGI-style response and **strips all headers** that were added by middleware underneath it in the stack. Since `DynamicCorsMiddleware` was added *after* `CORSMiddleware`, it became the outermost layer and its response object had no CORS headers to carry through. The browser received responses without `Access-Control-Allow-Origin` โ€” not because of CORS misconfiguration, but because the outermost middleware silently dropped them.
- **Fix**: Rewrote `DynamicCorsMiddleware` as a native ASGI middleware (`__init__(self, app)` + `__call__(self, scope, receive, send)`) that preserves headers from inner middleware and only injects tunnel-specific headers when needed. Added `conn.row_factory = sqlite3.Row` to `_verify_db_integrity()` so the DB integrity check no longer crashes (was showing `DATABASE_PATH` error in startup logs).

#### 2. ROOT CAUSE: brainprint_profiles DB schema mismatch

- **Problem**: The SCHEMA string correctly defines `user_id INTEGER NOT NULL` on `brainprint_profiles`, but the existing `brainprint.db` file was created on a different machine **before** that column existed. `init_db()` uses `CREATE TABLE IF NOT EXISTS` โ€” it does not alter existing tables. So the query `SELECT user_id FROM brainprint_profiles` failed with `no such column: user_id`.
- **Fix**: Added a post-init migration in `init_db()` that detects the missing column, creates a fresh table with the correct schema, re-inserts existing rows with `user_id=1` (single-user prototype), and logs the migration.

#### 3. End-to-End Verification โ€” 2026-08-09

| Endpoint | Status | CORS Headers | Body |
|----------|--------|-------------|------|
| `GET /health` (Origin: http://localhost:3000) | 200 OK | โ… `access-control-allow-origin: http://localhost:3000`, `access-control-allow-credentials: true`, `vary: Origin` | `{"status":"ok","qwen_configured":true,"startup":{"db":"ok","db_tables":{"users":"ok","chat_messages":"ok","brainprint_profiles":"ok"},"model":"not_loaded","qwen":"configured"}}` |
| `GET /api/brainprint/profiles` (Origin: http://localhost:3000, Bearer token) | 200 OK | โ… Same CORS headers | `[]` (empty array โ€” no profiles enrolled yet, but endpoint works) |

- **CORS allow_origins configured**: `http://localhost:3000`, `http://127.0.0.1:3000`, `ws://localhost:3000`, `ws://127.0.0.1:3000`, plus ngrok/cloudflare tunnel regex patterns
- **DB migration**: `brainprint_profiles` missing `user_id` column โ€” migrated successfully at startup
- **Startup status**: `db: ok`, all tables present, `model: not_loaded` (sklearn missing โ€” known follow-up)

### Files Changed

| File | Action | Description |
|------|--------|-------------|
| `neuropulse-backend/main.py` | Modified | Rewrote DynamicCorsMiddleware as native ASGI, added CORS startup logging, fixed _verify_db_integrity row_factory, imported DATABASE_PATH |
| `neuropulse-backend/db/database.py` | Modified | Added post-init migration for brainprint_profiles user_id column, added logging import |
| `PROJECT_LOG.md` | Updated | This log |

### Next Steps / Warnings

1. **Known follow-up**: `sklearn` not installed โ€” brain-state ML model from training pipeline won't load on this machine. Backend falls back to biomarker-only mode for the WebSocket stream. Install `scikit-learn` if model prediction is needed.

---

*This log is auto-maintained by AI collaborators. See `AI_INSTRUCTIONS.md` for rules.*

---

### 2026-08-09+07:00 โ€” AI Consultant 401 Unauthorized (Post-SECRET_KEY Rotation): Stale JWT Token

- **Symptom**: AI Consultant page returns "Not authenticated. Please log in." even when user is logged in. Browser console: `Failed to load resource: the server responded with a status of 401 (Unauthorized)`.
- **Root Cause**: The JWT token stored in `localStorage` (`auth_token`) was signed with the **old** `SECRET_KEY` (`[REDACTED-SECRET]`). After rotating to the **new** `SECRET_KEY` (`[REDACTED-SECRET]`), the backend's `jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])` in `get_current_user()` (line 246 of `main.py`) throws `JWTError` โ’ raises 401. This is **not** a missing token or wrong header โ€” the token simply cannot be verified with the new key.

#### 2. Verification โ€” All Checks Passed Except Token Freshness

| Check | File | Line | Result |
|-------|------|------|--------|
| `.env` SECRET_KEY matches `main.py` default? | `.env:17` vs `main.py:121` | โ… | `[REDACTED-SECRET]` in both |
| `.env` loading correct? | `main.py:43` | โ… | `load_dotenv(dotenv_path=Path(__file__).parent / ".env")` โ€” absolute path, works regardless of cwd |
| `os.getenv` picks up `.env` value? | `main.py:121` | โ… | `os.getenv("SECRET_KEY", "[REDACTED-SECRET]")` โ€” env var takes priority, fallback matches |
| Frontend sends `Authorization: Bearer` header? | `qwenApiHandler.ts:44` | โ… | `Authorization: Bearer ${token}` on POST `/api/qwen-chat` |
| Frontend sends `Authorization: Bearer` header? | `AIChatInterface.tsx:41` | โ… | `Authorization: Bearer ${token}` on GET `/api/qwen-chat/history` |
| Token extraction handles JSON object format? | `qwenApiHandler.ts:30-34` | โ… | Parses `{access_token: "...", token_type: "bearer"}` from localStorage |
| Token was signed with OLD key? | N/A (pre-rotation) | โ… | **This is the root cause** โ€” token predates the SECRET_KEY rotation |

#### 3. Fix Applied โ€” Stale Token Auto-Clear on 401

**Changes in `neuropulse-ai/lib/qwenApiHandler.ts`**:
- Added 401 handler before the generic error throw: when response is 401, clears `auth_token` and `user` from localStorage, throws a user-friendly "Session expired โ€” please log in again." message.
- This prevents silent failures and forces re-authentication with a fresh token.

**Changes in `neuropulse-ai/components/ai/AIChatInterface.tsx`**:
- Added same 401 handler in `loadChatHistory()`: clears stale localStorage entries on 401, returns empty array (user will see login prompt on next visit).

**Changes in `neuropulse-backend/main.py`**:
- Added startup log line to verify `.env` loading: `logger.info("SECRET_KEY loaded (first 8 chars): %s... (from env: %s)", ...)` โ€” shows whether key came from `.env` or fallback. This log was left in for debugging visibility (can be removed after confirming stable operation).

#### 4. User Action Required

The user **must log out and log in again** to get a fresh JWT token signed with the new `SECRET_KEY`. The old token in localStorage is cryptographically invalid under the new key โ€” no backend change can fix this without the user re-authenticating.

**Steps**:
1. Restart backend: `uvicorn main:app --reload --port 8765`
2. Navigate to frontend, click logout (or clear localStorage manually: `localStorage.removeItem("auth_token"); localStorage.removeItem("user")`)
3. Log in again โ’ fresh JWT token signed with `[REDACTED-SECRET]`
4. Navigate to /ai-consultant โ’ should work without 401

#### 5. Why This Won't Happen Again

- `SECRET_KEY` is now **static** (`[REDACTED-SECRET]`) โ€” it never changes between restarts or hot-reloads.
- Both `.env` and the `main.py` fallback are set to the same value.
- The only way the key changes is if someone explicitly edits `.env` โ€” in which case the 401 auto-clear handler will prompt re-login.

### Files Changed

| File | Action | Description |
|------|--------|-------------|
| `neuropulse-ai/lib/qwenApiHandler.ts` | Modified | Added 401 stale-token auto-clear + user-friendly error message |
| `neuropulse-ai/components/ai/AIChatInterface.tsx` | Modified | Added 401 stale-token auto-clear in `loadChatHistory()` |
| `neuropulse-backend/main.py` | Modified | Added startup log to verify SECRET_KEY source (.env vs fallback) |
| `PROJECT_LOG.md` | Updated | This log |

### Next Steps / Warnings

1. **Restart backend + re-login**: Required โ€” old JWT tokens are cryptographically invalid under the new key
2. **Verify**: After re-login, test both `/api/qwen-chat` (POST) and `/api/qwen-chat/history` (GET) โ€” both should return 200
3. **Monitor backend logs**: Check that startup log shows `SECRET_KEY loaded ... (from env: yes)` โ€” confirms `.env` is being read correctly
4. **No code changes needed**: Frontend already sends Bearer tokens correctly; the issue was purely stale auth state

---

### 2026-08-09+07:00 โ€” Qwen Chat 500 Fix: Missing `/chat/completions` in Gateway Endpoint

#### 1. Problem: `POST /api/qwen-chat` โ’ 500 "Not Found"

- **Symptom**: AI Consultant returns 500 error with detail `"Qwen API error: {"detail":"Not Found"}`.
- **Root Cause**: `QWEN_API_ENDPOINT` in `.env` was set to `https://gateway.9arm.co/v1` but `qwen_service.py` posts directly to `self.endpoint` without appending `/chat/completions`. The default fallback (`dashscope.aliyuncs.com/compatible-mode/v1/chat/completions`) includes the full path, so it worked โ€” but the gateway override was missing `/chat/completions`.
- **Verification**: `curl https://gateway.9arm.co/v1/models` returns `{"data":[{"id":"qwen3.6-35b-a3b"}]}` โ€” confirming the model name is valid. `curl https://gateway.9arm.co/v1/chat/completions` works. `curl https://gateway.9arm.co/v1` (without path) returns 404.

#### 2. Fix

**Changes in `neuropulse-backend/.env`**:
```diff
-QWEN_API_ENDPOINT=https://gateway.9arm.co/v1
+QWEN_API_ENDPOINT=https://gateway.9arm.co/v1/chat/completions
```

**Changes in `neuropulse-backend/.env.example`**:
```diff
-QWEN_API_ENDPOINT=https://gateway.9arm.co/v1
+QWEN_API_ENDPOINT=https://gateway.9arm.co/v1/chat/completions
```

#### 3. End-to-End Verification โ€” 2026-08-09

| Step | Result |
|------|--------|
| `GET /v1/models` | โ… Returns `qwen3.6-35b-a3b` |
| `POST /v1/chat/completions` (direct) | โ… Returns Thai greeting from real model |
| `POST /api/qwen-chat` (via backend) | โ… Returns Thai greeting, `latency_ms` populated |
| Backend startup log | โ… `Qwen configured: True` |

#### 4. Security Note

The Qwen API key (`<REDACTED — token_not_found_in_db on gateway>`) has been echoed into chat transcripts and log files during this debugging session. **Consider rotating this key** once confirmed stable.

### Files Changed

| File | Action | Description |
|------|--------|-------------|
| `neuropulse-backend/.env` | Modified | Fixed `QWEN_API_ENDPOINT` to include `/chat/completions` |
| `neuropulse-backend/.env.example` | Modified | Same fix for template |
| `PROJECT_LOG.md` | Updated | This log |

---

### 2026-08-10+07:00 — AI Consultant 422 Fix: Content-Type Header Deleted by Object Spread Ordering

#### 1. Problem: `POST /api/qwen-chat` → 422 Validation Error

- **Symptom**: AI Consultant chat returns 422 "Request Validation Error" when user sends a message.
- **Root Cause**: `apiFetch()` in `neuropulse-ai/lib/fetchWithHealth.ts` had an object spread ordering bug:
  ```typescript
  // BUGGY — headers key set first, then ...options replaces it entirely
  headers: { "Content-Type": "application/json", ...options.headers },
  ...options,          // ← replaces entire headers key, deleting Content-Type
  ```
  When the caller passes `headers: { Authorization: "Bearer ..." }`, the spread replaces the entire `headers` key — `Content-Type` is silently deleted. No error, no warning. FastAPI receives no Content-Type → rejects body as invalid JSON → 422.
- **Secondary bug**: `validation_exception_handler` in `main.py` crashed with 500 when trying to JSON-serialize `bytes` in the Pydantic validation error. Fixed by adding `_safe_errors()` helper that decodes bytes to UTF-8 string.

#### 2. Fix

**`neuropulse-ai/lib/fetchWithHealth.ts`** — pre-merge headers before spread:
```typescript
const mergedHeaders: Record<string, string> = {
  "Content-Type": "application/json",
  ...(options.headers as Record<string, string> || {}),
};
const res = await fetch(`${apiUrl}${path}`, {
  ...options,
  headers: mergedHeaders,   // ← spread options FIRST, then set headers AFTER
  signal: options.signal || AbortSignal.timeout(DEFAULT_TIMEOUT_MS),
});
```

**`neuropulse-backend/main.py`** — safe error serialization in validation exception handler:
```python
def _safe_errors(errors):
    out = []
    for e in errors:
        e = dict(e)
        if isinstance(e.get("input"), bytes):
            e["input"] = e["input"].decode("utf-8", errors="replace")
        out.append(e)
    return out
```

#### 3. Verification — 2026-08-10

| Check | Result |
|-------|--------|
| Request Headers show `content-type: application/json`? | ✅ Yes |
| Response shows real AI-generated reply (Thai)? | ✅ Yes |
| No more 422 errors on qwen-chat? | ✅ Confirmed |

### Files Changed

| File | Action | Description |
|------|--------|-------------|
| `neuropulse-ai/lib/fetchWithHealth.ts` | Modified | Fixed object spread ordering — pre-merge headers before fetch call |
| `neuropulse-backend/main.py` | Modified | Added `_safe_errors()` to validation_exception_handler to prevent 500 on bytes serialization |
| `PROJECT_LOG.md` | Updated | This log |

---

### 2026-08-10+07:00 — AI Consultant "API error undefined" Fix: Frontend Timeout Too Short

#### 1. Problem: "Error: API error undefined" in AI Consultant UI

- **Symptom**: After the Content-Type fix, sending "hi" produces "API error undefined" in the chat UI.
- **Root Cause**: Two issues:
  1. **Timeout too short**: `DEFAULT_TIMEOUT_MS = 10_000` (10s) in `fetchWithHealth.ts` is shorter than the backend Qwen API timeout (20s in `qwen_service.py`). When Qwen takes >10s, the frontend's `AbortSignal` fires → `fetch()` throws `TimeoutError` → caught as `FetchErrorType.TIMEOUT` with only `type` and `message` fields — **no `status`, no `detail`**.
  2. **Missing TIMEOUT handler**: `qwenApiHandler.ts:61` had no case for `TIMEOUT` — fell through to `throw new Error(err.detail || \`API error ${err.status}\`)` where both are undefined → "API error undefined".

#### 2. Fix

**`neuropulse-ai/lib/fetchWithHealth.ts`** — increased timeout from 10s to 25s:
```diff
-const DEFAULT_TIMEOUT_MS = 10_000;
+const DEFAULT_TIMEOUT_MS = 25_000;
```

**`neuropulse-ai/lib/qwenApiHandler.ts`** — added TIMEOUT handler with user-friendly message:
```typescript
if (err.type === FetchErrorType.TIMEOUT) {
  throw new Error(`Request timed out (${err.message}) — the Qwen API may be slow`);
}
throw new Error(err.detail || `API error ${err.status ?? "unknown"}`);
```

### Files Changed

| File | Action | Description |
|------|--------|-------------|
| `neuropulse-ai/lib/fetchWithHealth.ts` | Modified | Increased `DEFAULT_TIMEOUT_MS` from 10,000 to 25,000 |
| `neuropulse-ai/lib/qwenApiHandler.ts` | Modified | Added TIMEOUT error handler + safer fallback message |
| `PROJECT_LOG.md` | Updated | This log |

---

### 2026-08-16+07:00 — Reference-Data Subject Expansion (5 → 20 subjects)

#### 1. Task
Expand `eeg_reference_data` from 5 to ~20 distinct subjects for the Brainprint reference-comparison feature. Index scheme per `expand_reference_data.mne_index_to_subject_id()`: MNE index → `SC4{(idx*10+1):03d}` (0→SC4001, 1→SC4011, …82→SC4821). Valid range 0–82, excluding known-bad indices 39/68/69/78/79. Run `run_subject_expansion.py --target 20`.

#### 2. Root-Cause Bug — channel_name CHECK constraint silently skipped every insert
- **File**: `neuropulse-backend/run_subject_expansion.py` (new driver), underlying `expand_reference_data.import_to_db`
- **Problem**: The driver passed the full EDF channel name (`"EEG Fpz-Cz"`) into the DB `INSERT`, but `eeg_reference_data.channel_name` has a `CHECK(channel_name IN ('Fpz-Cz','Pz-Oz'))`. Because `INSERT OR IGNORE` suppresses all constraint violations, **every row was silently discarded** (`DB: 0 inserted, N skipped`) and the distinct-subject count never moved — with no error raised.
- **Fix**: Strip the `"EEG "` prefix before import: `db_channel = channel.replace("EEG ", "")`. The DB stores clean codes only (`['Fpz-Cz','Pz-Oz']`, verified 0 rows with `EEG ` prefix).

#### 3. Another blocker — long background jobs killed by harness (exit -1 / "detached")
- The monolithic download+process+import job (15 subjects, each ~50MB EDF download + ~2min Welch PSD) was repeatedly killed mid-run by the environment (exit code -1), advancing the DB only partially each time.
- **Workaround**: process from already-downloaded local files (`~/mne_data/physionet-sleep-data`) in short, no-network runs. All EDFs + hypnograms for SC4051–SC4231 were already on disk; SC4051–SC4191 were imported (as needed). SC4201–SC4231 remain downloaded-but-unimported.

#### 4. Verification — 2026-08-16
| Check | Result |
|-------|--------|
| DB distinct subjects | ✅ 20 |
| DB total rows | ✅ 54,587 |
| DB channel values | ✅ only `Fpz-Cz`, `Pz-Oz` |
| `GET /api/reference/subjects` (live) | ✅ 20 subjects, correct epoch counts |
| Subject IDs | SC4001…SC4041 (original 5) + SC4051, SC4061, SC4071, SC4081, SC4091, SC4101, SC4111, SC4121, SC4131, SC4141, SC4151, SC4161, SC4171, SC4181, SC4191 (new 15) |

#### 5. Notes / Warnings
- Minor cosmetic: the local processor passed `mne_idx=0` to `process_subject`, so its *log* line says "Computed N epochs for SC4001" even though it correctly exported/imported as the target subject (e.g. SC4171). Data is correct; label only.
- `SC4051`, `SC4061` were re-imported from JSON after the channel fix (no re-download). `SC4201–SC4231` EDFs+hypnograms are on disk but NOT yet in the DB (not needed to hit 20).
- The early broken runs left some `epochs_SC4*.json` exports in `reference-data/phase3_sleepstage/` — harmless (`INSERT OR IGNORE`), but a future cleanup could remove stale files if desired.

### Files Changed
| File | Action | Description |
|------|--------|-------------|
| `neuropulse-backend/run_subject_expansion.py` | **Created** | Task B driver: MNE index 0-82 (skip 39/68/69/78/79), dynamic stop at N distinct, correct DB channel handling |
| `neuropulse-backend/data/brainprint.db` | Modified | `eeg_reference_data` expanded 5 → 20 subjects (15 new, ~45,000 additional rows) |
| `reference-data/phase3_sleepstage/epochs_SC4*.json` | Created | Per-epoch band-power exports for new subjects |
| `PROJECT_LOG.md` | Updated | This log |

---

### 2026-08-16 — Backend `--reload` does NOT pick up `.env` changes (documented, expected)

#### 1. Task
Investigate why editing `services/qwen_service.py` / `.env` did not trigger the running `uvicorn --reload` worker to restart during Task R.

#### 2. Root cause (two parts)
- **`.env` is never reload-watched.** uvicorn's default reloader only watches `*.py` files (`DEFAULT_RELOAD_INCLUDES = ["*.py"]` in `venv_new/Lib/site-packages/uvicorn/supervisors/watchfilesreload.py:15`). `.env` has no `.py` extension, so editing it never fires a reload.
- **`python-dotenv` loads once at import.** `load_dotenv(dotenv_path=Path(__file__).parent / ".env")` (`main.py:44`) runs a single time when the module is imported and caches the values in `os.environ`. Even a fresh worker import re-reads it only at process start.

#### 3. Verdict
This is **expected behavior, not a bug** — do not hot-reload `.env`. `*.py` edits DO normally hot-reload. `.env` edits require a **full backend restart** (stop uvicorn, start again).

#### 4. Fix applied
- Added a code comment at `main.py:44` stating: `.env changes require a full backend restart, not just --reload` (dotenv loads once at import; uvicorn only watches `*.py`).
- This log entry (same note).

### Files Changed
| File | Action | Description |
|------|--------|-------------|
| `neuropulse-backend/main.py` | Modified | Added comment at `load_dotenv` re: `.env` requiring full restart |
| `PROJECT_LOG.md` | Updated | This log |

---

### 2026-08-16 — Task U: First-load default input mode is WebSocket (documented)

#### 1. Task
Confirm and document the default-mode UX behavior introduced by Task S, without changing it.

#### 2. Confirmed behavior (from code, conclusive)
- `neuropulse-ai/components/monitor/LiveMonitorView.tsx:60` — `const [mode, setMode] = useState<InputMode>("websocket");` (default = `"websocket"`).
- `LiveMonitorView.tsx:104-111` — the EEG waveform chart + headset-link widget (`EEGWaveformChart` + `ConnectionStatusWidget`) render **only when** `mode !== "websocket"` (conditional render, not CSS hide).
- **Consequence:** on a fresh page load with no interaction, the waveform chart and headset-link **are hidden by default**; the "About this project" panel reflows up to fill the gap. The user must switch to **File Upload** to reveal the chart/headset-link.

> **First-load default is websocket mode, so the chart and headset-link are hidden until the user switches to File Upload.** (This sentence should have been in the original Task S report; added here per Task U.)

- This was NOT changed; the default remains `"websocket"`. Changing it would be a UX/product decision requiring explicit user sign-off (Rule 2).
- Live browser screenshot was not executed in Task U: neither the frontend (port 3000) nor backend (port 8765) was running at verification time, and no browser-automation harness was present. Confirmation is from static code analysis, which is unambiguous on this point.

### Files Changed
| File | Action | Description |
|------|--------|-------------|
| `PROJECT_LOG.md` | Updated | Documented first-load default mode (websocket) hiding chart/headset-link until File Upload selected |
| `AI_INSTRUCTIONS.md` | Updated | Added two standing report rules (test-artifact reporting, UX/product-judgment flagging) |

---

### 2026-08-16 — Task V: AI Consultant 404 regression (stale backend process)

#### 1. Task
Fix the AI Consultant "Error: Not Found" regression that surfaced after Task T Part 3 (qwen→deepseek rename), then retry the live EEG-context test.

#### 2. Root cause
The frontend calls POST `/api/deepseek-chat` (via `sendToDeepSeekAIStream` → `lib/deepseekApiHandler.ts:104`), and the backend source registers `@app.post("/api/deepseek-chat")` (`main.py:577`). **On disk there was NO path mismatch.** The bug was a **stale running backend process**:
- Process PID 37692 started 09:02:56 **without `--reload`**
- `main.py` last modified 09:24:17 (21 min after start)
- The live process served the **pre-rename** codebase: `/api/qwen-chat` returned 401 (route existed), `/api/deepseek-chat` returned **404** (route absent), `/health` reported `"qwen_configured":true`.

#### 3. Fix applied
- Killed PID 37692 (explicitly authorized by user per classifier requirement).
- Restarted on port 8765 with `--reload`: `venv_new/Scripts/python.exe -m uvicorn main:app --host 0.0.0.0 --port 8765 --reload` (background, log → `neuropulse-backend/uvicorn_reload.log`).
- Verified: `/health` → `deepseek_configured:true`; `POST /api/deepseek-chat` → 401 (route exists); `GET /api/deepseek-chat/history` → 401; `/api/qwen-chat` → 404 (old route gone).

#### 4. Live EEG-context test — final proof (missing from Task T)
- One-shot check `test_eeg_context_wiring.py`: ALL CHECKS PASSED (mock gateway; proves `eeg_context` band-power values reach your outgoing LLM messages). Its `eegtest@example.com` temp user was cleaned up after.
- **Real gateway test**: logged in as the temp user, POSTed `/api/deepseek-chat` with prompt "why is my stress high" and a live EEG context `{delta:0.31, theta:0.25, alpha:0.14, beta:0.21, gamma:0.09, focusScore:42, stressLevel:78, mentalFatigue:66, faaIndex:-0.31}`. The real DeepSeek gateway streamed a Thai reply that **directly referenced the exact values**: stressLevel 78.0, focusScore 42.0, FAA −0.31, Beta 0.21, Delta 0.31, Alpha 0.14, Theta 0.25. **This is the missing proof: eeg_context reaches the model and shapes the response.**
- Transparency (Rule 2): this was an API-level reproduction of the exact UI flow (`AIChatInterface` → `sendToDeepSeekAIStream` → POST `/api/deepseek-chat`), NOT literal browser clicks (no harness). Functionally identical; in-browser proof offered.

#### 5. Test artifacts created / cleaned up
- Stopped test backend: the check script spawns on port 9876 (mock 9877) and terminates it internally.
- DB (data/brainprint.db): `eegtest@example.com` user id=12 + 5 chat_messages — **deleted** via scoped `DELETE ... WHERE user_id=12` / `WHERE id=12 AND email=...`, verified gone. Totals after: 7 users, 73 chat_messages (baseline intact).
- Files: removed `mock_gateway_capture.json`, `mock_gateway_messages.txt`, `real_chat_sse.txt`, `real_chat_full.txt`, `real_chat_reply_decoded.txt`. Kept `uvicorn_reload.log` (backend dev log).

### Files Changed
| File | Action | Description |
|------|--------|-------------|
| (no source changes) | — | Root cause was a stale process; disk source already correct |
| `PROJECT_LOG.md` | Updated | This log |
| memory `backend-restart-needs-authorization.md` | Added | Restarting the pre-existing 8765 backend requires explicit user naming of the PID; stale backend (no `--reload`) serves old routes |

---
