/**
 * lib/getBackendUrl.ts — Shared helper that resolves the backend base URL at
 * runtime.  Used by fetchWithHealth.ts, deepseekApiHandler.ts, the EEG WebSocket,
 * and any other component that needs to talk to the FastAPI backend.
 *
 * Resolution order:
 *   1. If NEXT_PUBLIC_API_URL is set in .env.local → always use that
 *      (this is what you set when testing behind a Cloudflare / ngrok tunnel).
 *   2. Else, if running on localhost / 127.0.0.1 → default to
 *      http://127.0.0.1:8765 (unchanged local dev behavior).
 *   3. Else (any other hostname, e.g. a tunnel domain) → fall back to the
 *      NEXT_PUBLIC_API_URL env-var default (http://127.0.0.1:8765) and log a
 *      console warning if it's unlikely to work.
 *
 * IMPORTANT: NEXT_PUBLIC_* vars are baked into the bundle at build/start
 * time.  This helper reads them so the same logic applies everywhere.
 */

// ---------------------------------------------------------------------------
// HTTP
// ---------------------------------------------------------------------------

let _httpCache: string | null = null;

export function getBackendHttpUrl(): string {
  if (_httpCache) return _httpCache;

  if (typeof window !== "undefined") {
    // Browser: read the compiled-in env var value.
    // @ts-ignore — NEXT_PUBLIC_API_URL is injected by Next.js at build time
    const envUrl: string | undefined = process.env.NEXT_PUBLIC_API_URL;
    if (envUrl && envUrl.trim()) {
      _httpCache = envUrl.replace(/\/+$/, "");
      return _httpCache;
    }
    const host = window.location.hostname;
    if (host === "localhost" || host === "127.0.0.1") {
      _httpCache = "http://127.0.0.1:8765";
      return _httpCache;
    }
    // Tunnel / remote hostname — NEXT_PUBLIC_API_URL wasn't set.
    // Log a warning; the user needs to set it in .env.local and restart.
    console.warn(
      "[getBackendUrl] NEXT_PUBLIC_API_URL is not set and this page is not " +
        "on localhost (" + host + "). Backend HTTP calls will fail. " +
        "Set NEXT_PUBLIC_API_URL in .env.local to the backend's tunnel URL " +
        "and restart the dev server."
    );
  }

  // Server-side or fallback — use the env var default.
  // @ts-ignore
  _httpCache = (process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8765").replace(/\/+$/, "");
  return _httpCache;
}

// ---------------------------------------------------------------------------
// WebSocket
// ---------------------------------------------------------------------------

let _wsCache: string | null = null;

/**
 * Return the full WebSocket endpoint URL (ws:// or wss:// + host + /ws/eeg-stream).
 * Derives the scheme from the HTTP URL (http → ws, https → wss).
 */
export function getBackendWsUrl(): string {
  if (_wsCache) return _wsCache;
  const http = getBackendHttpUrl();
  _wsCache = http.replace(/^http/, "ws") + "/ws/eeg-stream";
  return _wsCache;
}

// ---------------------------------------------------------------------------
// Reset helpers (useful for testing / hot-reload scenarios)
// ---------------------------------------------------------------------------

export function resetBackendUrlCache(): void {
  _httpCache = null;
  _wsCache = null;
}
