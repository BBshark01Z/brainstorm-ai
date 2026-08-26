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
import { getBackendHttpUrl } from "./getBackendUrl";

/**
 * Send a prompt to the backend AI consultant.
 * Requires JWT authentication via localStorage("auth_token").
 * `language` ("th" | "en") tells the backend to reply in the active UI language.
 */
export async function sendToDeepSeekAI(
  userPrompt: string,
  eegContext: Record<string, unknown> = {},
  language: "th" | "en" = "en"
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
    language,
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
  language: "th" | "en" = "en",
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

  // Resolve the backend base URL through the shared helper (NEXT_PUBLIC_API_URL
  // at build time, localhost:8765 in local dev) so this matches every other
  // backend call in the app.
  const apiUrl = getBackendHttpUrl();

  const res = await fetch(`${apiUrl}/api/deepseek-chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      user_prompt: userPrompt,
      eeg_context: eegContext,
      language,
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

      // Decode incrementally; { stream: true } keeps a partial multi-byte
      // UTF-8 sequence (Thai text!) in the decoder instead of corrupting it.
      buffer += decoder.decode(value, { stream: true });

      // Split on newlines but keep the (possibly incomplete) trailing line in
      // the buffer. Handle both "\n" and Windows-style "\r\n" — a stray "\r"
      // would otherwise break JSON.parse on the last field of each chunk.
      const lines = buffer.split(/\r?\n/);
      buffer = lines.pop() ?? "";

      for (const rawLine of lines) {
        const line = rawLine.trim();
        if (!line) continue;

        // SSE event lines: "data: <payload>". Tolerate "data:" with no space
        // and ignore non-data SSE fields (event:, id:, retry:, comments).
        if (!line.startsWith("data:")) continue;

        const payload = line.slice(5).trimStart();
        if (!payload) continue;
        if (payload === "[DONE]") continue;

        let parsed: Record<string, unknown> | null = null;
        try {
          parsed = JSON.parse(payload);
        } catch {
          // Non-JSON SSE line — skip
          continue;
        }
        // JSON.parse of "null" yields null — nothing to do with it.
        if (!parsed) continue;

        if (parsed.error) {
          // Backend signalled a stream error — surface it so the caller can
          // fall back to the local rule-based diagnostic.
          throw new Error(String(parsed.error));
        }

        // Token payload: backend sends { token }; accept { text } / { content }
        // defensively in case the wire format ever changes.
        const delta =
          (typeof parsed.token === "string" && parsed.token) ||
          (typeof parsed.text === "string" && parsed.text) ||
          (typeof parsed.content === "string" && parsed.content) ||
          "";
        if (delta) {
          fullReply += delta;
          onToken(delta);
        }
      }
    }
  } finally {
    reader.releaseLock();
  }

  return fullReply;
}