# NeuroPulse

NeuroPulse is a NeuroTech EEG monitoring platform with two services:

- **`neuropulse-ai/`** — Next.js 14 frontend (TypeScript, Tailwind CSS, Recharts)
- **`neuropulse-backend/`** — FastAPI backend (Python, MNE, SciPy, SQLite)

The platform provides real-time EEG monitoring, Brainprint biometric
authentication, longitudinal analytics, and an AI neuro-consultant
(DeepSeek integration).

> **All data is simulated.** NeuroPulse does not connect to real EEG
> hardware and, by default, makes no real LLM calls. The clinical
> algorithms included are illustrative heuristics and are **not validated
> for clinical use**. This is a software prototype, not a medical device.

---

## Architecture

Two independent services that talk over HTTP + WebSocket:

| Service | Stack | Port |
|---------|-------|------|
| `neuropulse-ai` (frontend) | Next.js 14, TypeScript, Tailwind, Recharts | `3000` |
| `neuropulse-backend` (backend) | FastAPI, MNE, SciPy, SQLite | `8765` |

The frontend has two input modes — **file** (upload a CSV/JSON/raw EEG
capture and replay it as a live stream) and **websocket** (live stream from
the backend) — unified behind a single data-source hook. The backend performs
the real signal processing (bandpower, entropy, embedding vectors) and serves
the Brainprint matching and the AI consultant.

---

## Prerequisites

- **Node.js** 18+ (frontend)
- **Python** 3.11+ (backend; developed on 3.13)

---

## 1. Backend (`neuropulse-backend/`)

```bash
cd neuropulse-backend
python3 -m venv venv
venv\Scripts\activate          # Windows   (venv/bin/activate on macOS/Linux)
pip install -r requirements.txt
```

Configure environment variables:

```bash
cp .env.example .env           # Windows: copy .env.example .env
```

Open `.env` and **set `SECRET_KEY` to a strong random value** (required — the
backend refuses to start without it). Optionally set `DEEPSEEK_API_KEY` to
enable the AI neuro-consultant; leave it empty to run without it.

Run:

```bash
uvicorn main:app --reload --port 8765
```

Interactive API docs: <http://localhost:8765/docs>

> **`.env` changes require a full backend restart** — `--reload` only watches
> `*.py` files, and the environment is loaded once at import. Edit `.env` →
> stop uvicorn → start again. `.py` edits hot-reload.

## 2. Frontend (`neuropulse-ai/`)

```bash
cd neuropulse-ai
npm install
npm run dev                    # http://localhost:3000 (redirects to /dashboard)
```

By default the frontend talks to `http://127.0.0.1:8765`. If you access the
app through a non-localhost hostname (Cloudflare tunnel, ngrok, a deployed
host), set `NEXT_PUBLIC_API_URL` in `neuropulse-ai/.env.local` (see
`neuropulse-ai/.env.example`) and restart the dev server.

---

## Configuration

Key environment variables (see `neuropulse-backend/.env.example` for the full
list — it contains placeholders only, never real values):

| Variable | Default | Description |
|----------|---------|-------------|
| `SECRET_KEY` | *(must be set)* | Signing key for JWT auth. Required. |
| `DEEPSEEK_API_KEY` | *(unset)* | API key for real AI-consultant calls; unset = consultant returns 500. |
| `DEEPSEEK_API_ENDPOINT` | DashScope compatible-mode | AI endpoint URL. |
| `DEEPSEEK_MODEL` | `qwen3.8-27b-fp8` | AI model ID. |
| `DATABASE_PATH` | `./data/brainprint.db` | SQLite database location. |
| `CORS_ORIGINS` | `http://localhost:3000,http://127.0.0.1:3000` | Comma-separated allowed origins. |
| `BRAINPRINT_SIMILARITY_THRESHOLD` | `0.82` | Min cosine similarity for a VERIFIED match. |
| `BRAINPRINT_MAHALANOBIS_THRESHOLD` | `3.0` | Max Mahalanobis distance for in-distribution. |
| `MIN_PROFILES_FOR_MAHALANOBIS` | `8` | Profiles enrolled before Mahalanobis kicks in. |

---

## Notes

- **JWT authentication** protects the sensitive backend endpoints; the API key
  for the AI consultant lives only server-side on the backend and is never
  shipped in the browser bundle.
- **Brainprint matching is computed server-side.** Never trust
  client-computed match scores for access control.
- **SQLite** is fine at prototype scale; a real deployment needs a proper
  database with row-level access control.
