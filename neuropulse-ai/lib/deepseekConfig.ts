// ---------------------------------------------------------------------------
// NeuroPulse AI — DeepSeek service configuration
//
// Set DEEPSEEK_API_KEY via environment variable (preferred) for real DeepSeek calls.
// If unset or empty, the backend returns 500 on DeepSeek chat endpoints.
//
// ⚠️ Import this file ONLY from server-side code (Route Handlers, Server
// Components) — e.g. app/api/ai/consult/route.ts. Never import it from a
// "use client" component; Next.js would otherwise bundle the key into the
// browser's JavaScript. Because it's a plain (non-`NEXT_PUBLIC_`) env var,
// Next.js already refuses to expose it to the client bundle — this comment
// is a guardrail for anyone editing this file later, not a security gap.
// ---------------------------------------------------------------------------

export const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY || "";

export const DEEPSEEK_API_ENDPOINT =
  process.env.DEEPSEEK_API_ENDPOINT ||
  "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions";

export const DEEPSEEK_MODEL = process.env.DEEPSEEK_MODEL || "deepseek-v4-flash-0731";

/** True once a real key has been configured. */
export function isDeepSeekConfigured(): boolean {
  return DEEPSEEK_API_KEY.trim().length > 0;
}