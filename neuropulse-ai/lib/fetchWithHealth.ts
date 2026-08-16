/**
 * lib/fetchWithHealth.ts — Shared fetch wrapper with network error handling.
 *
 * Wraps every raw `fetch()` call in the Neuropulse frontend so that:
 *   1. Network failures (backend unreachable, CORS block, wrong URL/port) are
 *      caught as a distinct `FetchErrorType.NETWORK` with a human-readable
 *      message — NOT as an unhandled promise rejection.
 *   2. HTTP error statuses (4xx, 5xx) are caught as `FetchErrorType.HTTP` and
 *      include the parsed backend JSON detail when available.
 *   3. The frontend can ping `/health` on load to detect connection issues
 *      before they manifest as mysterious fetch failures in the UI.
 *
 * Usage:
 *   const result = await apiFetch("/api/brainprint/profiles", {
 *     headers: { Authorization: `Bearer ${token}` },
 *   });
 *   // result.ok === false → check result.error.type for details
 *
 * SEE ALSO: neuropulse-backend/main.py — global_exception_handler that
 * ensures CORS headers are attached to ALL responses, including 500s.
 */

import { getBackendHttpUrl } from "./getBackendUrl";

export enum FetchErrorType {
  NETWORK = "network",       // fetch() threw (ECONNREFUSED, CORS, DNS)
  HTTP = "http",             // HTTP error status (4xx, 5xx)
  TIMEOUT = "timeout",       // request timed out
  PARSE = "parse",           // response body failed JSON parse
}

export interface FetchError extends Error {
  type: FetchErrorType;
  status?: number;
  /** Normalized human-readable message. For FastAPI 422s this joins all validation error .msg fields. */
  detail?: string;
}

export type FetchResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: FetchError };

const DEFAULT_TIMEOUT_MS = 25_000;

/**
 * Ping the backend /health endpoint to check connectivity.
 * Returns true if the backend is reachable and healthy.
 */
export async function checkBackendHealth(
  apiUrl?: string
): Promise<{ healthy: boolean; status?: string; deepseekConfigured?: boolean; startup?: Record<string, unknown>; error?: string }> {
  // If no explicit apiUrl is provided, derive from the shared helper.
  const base = (apiUrl ?? getBackendHttpUrl()).replace(/\/+$/, "");
  try {
    const res = await fetch(`${base}/health`, {
      signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS),
    });
    if (!res.ok) {
      return { healthy: false, error: `Health check returned ${res.status}` };
    }
    const data = await res.json().catch(() => ({}));
    return {
      healthy: data.status === "ok",
      status: data.status,
      deepseekConfigured: data.deepseek_configured,
      startup: data.startup,
    };
  } catch (err) {
    return {
      healthy: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

/**
 * A fetch wrapper that distinguishes network failures from HTTP errors.
 *
 * @param path - Path relative to the API base (e.g. "/api/brainprint/profiles")
 * @param options - fetch options (headers, method, body, etc.)
 * @returns A typed result: { ok: true, data: T } or { ok: false, error: FetchError }
 */
export async function apiFetch<T = unknown>(
  path: string,
  options: RequestInit = {}
): Promise<FetchResult<T>> {
  const apiUrl = getBackendHttpUrl();

  try {
    // Merge headers so Content-Type is ALWAYS present alongside caller-supplied headers.
    // IMPORTANT: do NOT put ...options before the headers key — object spread replaces
    // the entire key, so a caller-supplied headers: { Authorization: ... } would silently
    // delete Content-Type. Build mergedHeaders first, then spread options last.
    const mergedHeaders: Record<string, string> = {
      "Content-Type": "application/json",
      ...(options.headers as Record<string, string> || {}),
    };
    const res = await fetch(`${apiUrl}${path}`, {
      ...options,
      headers: mergedHeaders,
      signal: options.signal || AbortSignal.timeout(DEFAULT_TIMEOUT_MS),
    });

    // Success
    if (res.ok) {
      try {
        const data: T = await res.json();
        return { ok: true, data };
      } catch {
        return {
          ok: false,
          error: {
            name: "FetchError",
            type: FetchErrorType.PARSE,
            message: "Failed to parse response body as JSON",
          },
        };
      }
    }

    // HTTP error — try to extract backend detail.
    //
    // FastAPI returns different shapes depending on the error type:
    //   422 Validation Error → { detail: [{ loc, msg, type }, ...] }  (array)
    //   400/401/403           → { detail: "string message" }           (string)
    //   500                   → { error: "Internal server error", detail: "..." }
    //
    // We normalize everything into a single human-readable string.
    let detail = `HTTP ${res.status}`;
    try {
      const body = await res.json();
      const raw = body.detail ?? body.error;
      if (Array.isArray(raw)) {
        // FastAPI 422: join each validation error object into a readable string
        detail = raw.map((e: any) => e.msg ?? e.message ?? JSON.stringify(e)).join("; ");
      } else if (typeof raw === "string") {
        detail = raw;
      } else if (raw != null) {
        // Unexpected shape (e.g. nested object) — stringify gracefully
        detail = String(raw);
      }
    } catch {
      // Response body is not JSON — keep the status code as detail
    }

    return {
      ok: false,
      error: {
        name: "FetchError",
        type: FetchErrorType.HTTP,
        status: res.status,
        message: detail,
        detail,
      },
    };
  } catch (err) {
    // Network failure — fetch() threw before we got a Response
    if (err instanceof DOMException && err.name === "TimeoutError") {
      return {
        ok: false,
        error: {
          name: "FetchError",
          type: FetchErrorType.TIMEOUT,
          message: "Request timed out — the backend may be slow or unresponsive",
        },
      };
    }

    // Distinguish between a genuine network failure (backend truly down)
    // and a CORS block (backend reachable but browser blocked the response).
    //
    // Browsers report CORS failures as a generic `TypeError` with no status
    // code.  A real connection-refused also throws `TypeError`, but the
    // `cause` property often contains "ECONNREFUSED" (Node/Next.js) or
    // "connect ECONNREFUSED" (Chrome).  We check for that heuristic.
    //
    // This is not 100% reliable (browsers intentionally obfuscate CORS
    // errors for security), but it catches the common case where the
    // frontend runs on port 3001 and the backend's CORS_ORIGINS doesn't
    // include it — the browser blocks the preflight and we can tell the
    // user the real problem instead of "backend not running."
    const errMsg = err instanceof Error ? err.message : "";
    const errCause = (err as any).cause;
    const causeStr = errCause && typeof errCause === "object" ? String(errCause) : String(errCause ?? "");
    const isConnectionRefused =
      /ECONNREFUSED/i.test(errMsg) || /ECONNREFUSED/i.test(causeStr);

    if (isConnectionRefused) {
      return {
        ok: false,
        error: {
          name: "FetchError",
          type: FetchErrorType.NETWORK,
          message:
            "Backend unreachable — is it running on port 8765? (ECONNREFUSED)",
        },
      };
    }

    // Likely a CORS block: the backend is reachable (TCP connected) but the
    // browser refused to expose the response because the Origin header
    // isn't in the backend's CORS allow list.
    //
    // The origin is available via document.origin (e.g. "http://localhost:3000").
    // We use it in the message so it's accurate regardless of which port the
    // dev server is actually running on.
    const origin =
      typeof window !== "undefined" && window.location.origin
        ? window.location.origin
        : "localhost";
    return {
      ok: false,
      error: {
        name: "FetchError",
        type: FetchErrorType.NETWORK,
        message:
          `Backend reachable but response blocked by CORS — check that ${origin} is in the backend's CORS_ORIGINS.`,
      },
    };
  }
}
