# NeuroPulse AI — Backend

FastAPI backend for EEG feature extraction, dynamic multi-profile Brainprint
recognition with out-of-distribution ("unknown signature") detection, and a
DeepSeek AI consultant wrapper. Pairs with the `neuropulse-ai` Next.js frontend
built earlier — the WebSocket default port (`8765`) and JSON shapes match
that frontend's `useWebSocketStream` hook out of the box.

## Setup

```bash
python3 -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env             # then fill in DEEPSEEK_API_KEY if you have one
uvicorn main:app --reload --port 8765
```

MNE is a fairly large dependency (brings in its own scientific-Python
stack) — the first `pip install` may take a few minutes. Feature extraction
still works without it (falls back to a SciPy Butterworth filter, see
`services/feature_extractor.py`), but MNE's FIR filtering is the more
standard choice for EEG and is what the rest of the pipeline is tuned for.

Visit `http://localhost:8765/docs` for the interactive Swagger UI once it's running.

## File structure

```
main.py                    FastAPI app: all REST endpoints + the WebSocket stream
schemas.py                  Every request/response Pydantic model
services/
  feature_extractor.py       Filtering, PSD band power, differential entropy, Hjorth, FAA, TBR
  brainprint_ml.py            Cosine-similarity matching + Mahalanobis-distance OOD detection
  deepseek_service.py          DeepSeekBrainConsultant — real DeepSeek call or Thai mock fallback
db/
  database.py                  SQLite persistence for enrolled Brainprint profiles
data/
  brainprint.db                 Created automatically on first run
```

## How recognition works (`services/brainprint_ml.py`)

Every `/api/brainprint/verify` call runs two checks against the embedding vector:

1. **Cosine similarity** to every enrolled profile — picks the closest match.
2. **Mahalanobis distance** to the *overall enrolled population* — a
   standard out-of-distribution (OOD) detection technique. A capture can
   look deceptively close to one profile by cosine similarity alone while
   still being globally unusual; Mahalanobis distance catches that.

A capture is `VERIFIED` only if it clears **both** the similarity threshold
(`BRAINPRINT_SIMILARITY_THRESHOLD`, default 0.82) and the novelty threshold
(`BRAINPRINT_MAHALANOBIS_THRESHOLD`, default 3.0) — otherwise it's
`UNKNOWN_SIGNATURE_DETECTED`. Mahalanobis distance needs a reasonably-sized,
well-conditioned covariance matrix, so it silently falls back to
cosine-only matching until at least 8 profiles are enrolled
(`MIN_PROFILES_FOR_MAHALANOBIS`).

New profiles from `/api/brainprint/register` write straight to SQLite, and
every `/verify` call re-reads the full profile table fresh — so a
just-registered nickname is recognizable on the very next request with no
server restart and no cache to invalidate.

## DeepSeek integration

`services/deepseek_service.py`'s `DeepSeekBrainConsultant`:

- `DEEPSEEK_API_KEY` unset → `consult()` raises `HTTPException(500)` — the
  caller must handle it (e.g. `/api/analytics/tip` degrades to a local tip).
- `DEEPSEEK_API_KEY` set → calls the real endpoint (the gateway URL set via
  `DEEPSEEK_API_ENDPOINT`, defaulting to DashScope's OpenAI-compatible API;
  point it elsewhere for a different provider) and returns the live reply.
- Any real-call failure (bad key, rate limit, network) raises an
  `HTTPException` rather than degrading to a mock — the `/api/deepseek-chat`
  endpoint streams SSE or returns the error to the client.

## WebSocket demo stream (`/ws/eeg-stream`)

Connect and it starts pushing immediately — no message needs to be sent
from the client. Every ~300ms it:

1. Generates a fresh 4-second synthetic raw window (`services/demo_signal_source.py`)
2. Runs it through the **real** filter → Welch PSD pipeline (`services/feature_extractor.py`)
3. Pushes a flat JSON object shaped exactly like the frontend's `EEGSample` type:
   `{"delta": ..., "theta": ..., "alpha": ..., "beta": ..., "gamma": ..., "alphaF3": ..., "alphaF4": ...}`

That shape matches the Next.js frontend's `hooks/useWebSocketStream.ts`
exactly, so pointing the frontend's WebSocket input mode at
`ws://localhost:8765/ws/eeg-stream` (the default) shows live data with zero
frontend code changes — the values are computed by the real signal
processing pipeline, just fed from a synthetic generator instead of real
hardware for now.

**Swapping in real hardware later:** replace `generate_raw_window()`'s
synthetic generator with your device SDK's buffered samples (same
`{"generic": ..., "F3": ..., "F4": ...}` shape) — the filtering, PSD, and
push loop underneath don't need to change.

A 4-second window is used deliberately rather than tiny per-tick chunks — a
clean 0.5 Hz filter edge needs several seconds of data to resolve well;
`apply_filters()` also falls back to a SciPy Butterworth filter if MNE's
FIR design ever fails on a too-short buffer, so this degrades gracefully
rather than crashing the stream.

## Connecting the two EEG feature pipelines

The Next.js frontend's mock data (`lib/mockData.ts`) and this backend's real
signal processing (`services/feature_extractor.py`) are intentionally
*not* required to match sample-for-sample — the frontend's simulator is for
UI development without hardware attached; this backend is where real
filtered/PSD-derived features get computed once actual EEG data (live
hardware or a public dataset) is in the loop. `AnalyzeResponse.embedding`
is the vector shape to feed into `/api/brainprint/verify` and
`/api/brainprint/register`.

## What's still a prototype, not production

- No authentication on any endpoint — add an auth layer before this ever
  faces real users or real EEG/biometric data.
- SQLite is fine for a few thousand profiles on one machine; a real
  multi-tenant deployment needs a proper database with row-level access
  control (see the architecture discussion from the frontend project).
- The Mahalanobis-based novelty check is a solid, real OOD technique but
  hasn't been validated against a labeled "genuinely unknown person"
  dataset — tune both thresholds against real enrolled data before trusting
  the VERIFIED/UNKNOWN boundary for anything consequential.
