// ---------------------------------------------------------------------------
// NeuroPulse AI — DeepSeek AI Consultant client (production)
//
// The chat UI calls `sendToDeepSeekAI`, which POSTs to the backend's own
// `/api/deepseek-chat` endpoint. The backend handles the DeepSeek API call directly
// — no mock fallback. If DEEPSEEK_API_KEY is not configured on the backend,
// the API returns 500.
// ---------------------------------------------------------------------------

import { DeepSeekAIResponse } from "./types";
import { apiFetch, FetchErrorType } from "./fetchWithHealth";

/**
 * Send a prompt to the backend AI consultant.
 * Requires JWT authentication via localStorage("auth_token").
 */
export async function sendToDeepSeekAI(
  userPrompt: string,
  eegContext: Record<string, unknown> = {}
): Promise<DeepSeekAIResponse> {
  const rawToken = localStorage.getItem("auth_token");
  if (!rawToken) {
    throw new Error("Not authenticated. Please log in.");
  }
  // useAuth stores token as JSON object — extract the actual JWT
  let token: string;
  if (typeof rawToken === "string" && rawToken.startsWith("{")) {
    const parsed = JSON.parse(rawToken);
    token = parsed.access_token ?? rawToken;
  } else {
    token = rawToken;
  }
  if (!token || typeof token !== "string") {
    throw new Error("Not authenticated. Please log in.");
  }

  const payload = {
    user_prompt: userPrompt,
    eeg_context: eegContext,
  };
  const result = await apiFetch<{ reply: string; flagged_markers?: string[]; latency_ms?: number }>("/api/deepseek-chat", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload),
  });

  if (!result.ok) {
    const err = result.error;
    // If we get HTTP 401, the JWT token was signed with an old SECRET_KEY.
    // Clear stale auth so the user is forced to re-login with a fresh token.
    if (err.type === FetchErrorType.HTTP && err.status === 401) {
      localStorage.removeItem("auth_token");
      localStorage.removeItem("user");
      throw new Error(
        "Session expired — SECRET_KEY was rotated. Please log in again."
      );
    }
    if (err.type === FetchErrorType.NETWORK) {
      throw new Error(`Backend unreachable: ${err.message}`);
    }
    if (err.type === FetchErrorType.TIMEOUT) {
      throw new Error(`Request timed out (${err.message}) — the DeepSeek API may be slow`);
    }
    throw new Error(err.detail || `API error ${err.status ?? "unknown"}`);
  }

  const data = result.data;
  return {
    reply: data.reply,
    flaggedMarkers: data.flagged_markers || [],
    latencyMs: data.latency_ms || 0,
  };
}

/**
 * SSE-based streaming variant of sendToDeepSeekAI.
 * Reads the backend's SSE stream token-by-token and calls onToken
 * for each chunk. Returns the full assembled reply (or throws on error).
 */
export async function sendToDeepSeekAIStream(
  userPrompt: string,
  eegContext: Record<string, unknown> = {},
  onToken: (token: string) => void,
): Promise<string> {
  const rawToken = localStorage.getItem("auth_token");
  if (!rawToken) {
    throw new Error("Not authenticated. Please log in.");
  }
  let token: string;
  if (typeof rawToken === "string" && rawToken.startsWith("{")) {
    const parsed = JSON.parse(rawToken);
    token = parsed.access_token ?? rawToken;
  } else {
    token = rawToken;
  }
  if (!token || typeof token !== "string") {
    throw new Error("Not authenticated. Please log in.");
  }

  // Resolve backend base from the build-time env var; fall back to local dev.
  // NEXT_PUBLIC_API_URL must be set at build time for deployed environments.
  const apiUrl =
    (process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8765").replace(/\/+$/, "");

  const res = await fetch(`${apiUrl}/api/deepseek-chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      user_prompt: userPrompt,
      eeg_context: eegContext,
    }),
  });

  if (!res.ok) {
    // Try to parse error detail from the response body
    let detail = `HTTP ${res.status}`;
    try {
      const body = await res.json();
      detail = body.detail ?? body.error ?? detail;
    } catch { /* non-JSON error body — keep status code */ }
    throw new Error(detail);
  }

  // Read the SSE stream
  const reader = res.body?.getReader();
  if (!reader) {
    throw new Error("Streaming not supported — backend returned no body");
  }

  const decoder = new TextDecoder();
  let buffer = "";
  let fullReply = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? ""; // keep incomplete line in buffer

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("data: ")) continue;

        const payload = trimmed.slice(6);
        if (payload === "[DONE]") continue;

        try {
          const parsed = JSON.parse(payload);
          if (parsed.error) {
            throw new Error(parsed.error);
          }
          if (parsed.token) {
            fullReply += parsed.token;
            onToken(parsed.token);
          }
        } catch {
          // Non-JSON SSE line — skip
        }
      }
    }
  } finally {
    reader.releaseLock();
  }

  return fullReply;
}