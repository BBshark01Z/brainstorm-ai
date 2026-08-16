"use client";

import { useRef, useEffect, useState } from "react";
import { Send, Bot, User, Loader2, Zap, ZapOff } from "lucide-react";
import clsx from "clsx";
import { ChatMessage, EEGSample, DerivedMetrics } from "@/lib/types";
import { sendToDeepSeekAIStream } from "@/lib/deepseekApiHandler";
import { PromptChips } from "./PromptChips";
import { apiFetch, FetchErrorType } from "@/lib/fetchWithHealth";
import { useEEGContext } from "@/hooks/useEEGContext";

// Use relative path — Next.js rewrites /api/* to the backend.
// Works locally and behind Cloudflare/ngrok tunnel.
const API_BASE = "";

/** Reveals text progressively so a reply reads as "streaming".
 * A real SSE-based token stream from the DeepSeek backend would replace this with
 * chunks arriving from the network instead of a client-side timer. */
async function streamReveal(text: string, onChunk: (partial: string) => void) {
  const CHUNK = 3;
  for (let i = 0; i <= text.length; i += CHUNK) {
    onChunk(text.slice(0, i));
    await new Promise((resolve) => setTimeout(resolve, 16));
  }
  onChunk(text);
}

/** Load chat history from the backend on mount. */
async function loadChatHistory(rawToken: string): Promise<ChatMessage[]> {
  // useAuth stores token as JSON object — extract the actual JWT
  let token: string;
  if (typeof rawToken === "string" && rawToken.startsWith("{")) {
    const parsed = JSON.parse(rawToken);
    token = parsed.access_token ?? rawToken;
  } else {
    token = rawToken;
  }
  if (!token || typeof token !== "string") {
    return [];
  }
  const result = await apiFetch<any[]>("/api/deepseek-chat/history", {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!result.ok) {
    const err = result.error;
    // 401 means the JWT was signed with an old SECRET_KEY — clear stale auth
    if (err.type === FetchErrorType.HTTP && err.status === 401) {
      localStorage.removeItem("auth_token");
      localStorage.removeItem("user");
    }
    return [];
  }
  const data = result.data;
  return data.map((msg: any) => ({
    id: String(msg.id),
    role: msg.role,
    content: msg.content,
    timestamp: new Date(msg.created_at).getTime(),
  }));
}

export function AIChatInterface() {
  const eeg = useEEGContext();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isThinking, setIsThinking] = useState(false);
  const [deepseekStatus, setDeepSeekStatus] = useState<"live" | "error" | null>(null);
  const [deepseekReason, setDeepSeekReason] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Load chat history and auth token on mount
  useEffect(() => {
    const token = localStorage.getItem("auth_token");
    if (!token) {
      setMessages([
        {
          id: "welcome",
          role: "assistant",
          content:
            "สวัสดีครับ กรุณาเข้าสู่ระบบเพื่อเริ่มสนทนากับ AI Neuro-Consultant",
          timestamp: Date.now(),
        },
      ]);
      return;
    }

    loadChatHistory(token)
      .then((history) => {
        if (history.length === 0) {
          setMessages([
            {
              id: "welcome",
              role: "assistant",
              content:
                "I'm your Neuro-Consultant. Ask me about your brain health, recovery protocols, or EEG analysis.",
              timestamp: Date.now(),
            },
          ]);
        } else {
          setMessages(history);
        }
      })
      .catch(() => {
        setDeepSeekStatus("error");
        setDeepSeekReason("Failed to load chat history");
      });
  }, []);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages]);

  /**
   * Build a lightweight EEG context snapshot from the live context.
   * The backend DeepSeekChatRequest expects eeg_context as a plain Dict.
   * We send the latest sample bands + derived metrics so the AI can
   * ground its reply in actual numbers instead of answering in a vacuum.
   *
   * Returns {} (empty object) when no data is available yet — the
   * backend treats this as "no EEG context" and answers generically.
   */
  const buildEEGContextSnapshot = (): Record<string, unknown> => {
    if (!eeg.latestSample) return {};

    return {
      // Raw band powers (relative power from WebSocket)
      delta: eeg.latestSample.delta,
      theta: eeg.latestSample.theta,
      alpha: eeg.latestSample.alpha,
      beta: eeg.latestSample.beta,
      gamma: eeg.latestSample.gamma,
      alphaF3: eeg.latestSample.alphaF3,
      alphaF4: eeg.latestSample.alphaF4,
      // Derived cognitive metrics
      focusScore: eeg.metrics.focusScore,
      stressLevel: eeg.metrics.stressLevel,
      mentalFatigue: eeg.metrics.mentalFatigue,
      faaIndex: eeg.metrics.faaIndex,
      // Connection state for context
      connectionState: eeg.connectionLabel,
    };
  };

  const submitPrompt = async (prompt: string) => {
    if (!prompt.trim() || isThinking) return;

    const token = localStorage.getItem("auth_token");
    if (!token) {
      setDeepSeekStatus("error");
      setDeepSeekReason("Not authenticated. Please log in.");
      return;
    }

    setMessages((prev) => [
      ...prev,
      { id: `msg-${Date.now()}`, role: "user", content: prompt, timestamp: Date.now() },
    ]);
    setInput("");
    setIsThinking(true);

    try {
      // Build a grounded EEG context snapshot so the AI can reference
      // the user's actual brain-state metrics instead of answering in a vacuum.
      const eegContext = buildEEGContextSnapshot();
      const assistantId = `msg-${Date.now()}-ai`;
      setMessages((prev) => [
        ...prev,
        { id: assistantId, role: "assistant", content: "", timestamp: Date.now() },
      ]);

      // Stream tokens from the backend in real-time
      setDeepSeekStatus("live");
      setDeepSeekReason(null);
      await sendToDeepSeekAIStream(
        prompt,
        eegContext,
        (token) => {
          setMessages((prev) =>
            prev.map((m) => (m.id === assistantId ? { ...m, content: m.content + token } : m))
          );
          scrollRef.current?.scrollTo({
            top: scrollRef.current.scrollHeight,
            behavior: "smooth",
          });
        }
      );
      setIsThinking(false);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error";
      setDeepSeekStatus("error");
      setDeepSeekReason(message);
      setIsThinking(false);
      setMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          role: "assistant",
          content: `Error: ${message}`,
          timestamp: Date.now(),
        },
      ]);
    }
  };

  return (
    <div className="rise-in" style={{ animationDelay: "120ms" }}>
    <div
      className="glass-raised flex flex-col overflow-hidden rounded-2xl"
      style={{
        height: "560px",
        boxShadow: "0 0 40px -10px rgba(6, 182, 212, 0.2), 0 0 80px -20px rgba(139, 92, 246, 0.1)",
      }}
    >
      {/* Top accent line */}
      <div
        className="h-0.5 w-full"
        style={{
          background: "linear-gradient(90deg, transparent, #06B6D4, #8B5CF6, transparent)",
        }}
      />

      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-700/30 bg-base-overlay/30 px-5 py-3.5">
        <div className="flex items-center gap-2.5">
          <div
            className="flex h-8 w-8 items-center justify-center rounded-lg"
            style={{ background: "rgba(6, 182, 212, 0.12)" }}
          >
            <Bot size={16} className="text-cyan-400" />
          </div>
          <div>
            <h2 className="font-display text-sm font-semibold text-white">AI Neuro-Consultant</h2>
            <p className="text-[10px] text-slate-500">Powered by DeepSeek AI</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {deepseekStatus !== null && (
            <span
              className={clsx(
                "glass-pill flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider",
                deepseekStatus === "live"
                  ? "text-emerald-400"
                  : "text-risk-red"
              )}
              title={
                deepseekStatus === "live"
                  ? "Connected to DeepSeek AI — real analysis"
                  : deepseekReason || "Error"
              }
            >
              <span className="h-1.5 w-1.5 rounded-full" style={{
                backgroundColor: deepseekStatus === "live" ? "#10B981" : "#EF4444",
                boxShadow: deepseekStatus === "live" ? "0 0 6px #10B981" : "0 0 6px #EF4444",
              }} />
              {deepseekStatus === "live" ? "Live" : "Error"}
            </span>
          )}
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-4">
        <div className="space-y-4">
          {messages.map((msg) => (
            <div key={msg.id} className={clsx("flex gap-2.5", msg.role === "user" ? "justify-end" : "justify-start")}>
              {msg.role === "assistant" && (
                <div
                  className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg"
                  style={{ background: "rgba(6, 182, 212, 0.12)" }}
                >
                  <Bot size={14} className="text-cyan-400" />
                </div>
              )}
              <div
                className={clsx(
                  "max-w-[75%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed",
                  msg.role === "user"
                    ? "rounded-br-md"
                    : "rounded-bl-md"
                )}
                style={{
                  background: msg.role === "user"
                    ? "linear-gradient(135deg, rgba(6, 182, 212, 0.18), rgba(6, 182, 212, 0.08))"
                    : "var(--surface-glass)",
                  border: msg.role === "user"
                    ? "1px solid rgba(6, 182, 212, 0.25)"
                    : "1px solid var(--hairline-default)",
                }}
              >
                {msg.content || (
                  <span className="inline-flex items-center gap-1 text-cyan-400/60">
                    <Loader2 size={12} className="animate-spin" />
                    <span className="animate-pulse">▍</span>
                  </span>
                )}
              </div>
              {msg.role === "user" && (
                <div
                  className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg"
                  style={{ background: "rgba(139, 92, 246, 0.15)" }}
                >
                  <User size={14} className="text-violet-400" />
                </div>
              )}
            </div>
          ))}
          {isThinking && (
            <div className="flex items-center gap-2.5">
              <div
                className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg"
                style={{ background: "rgba(6, 182, 212, 0.12)" }}
              >
                <Bot size={14} className="text-cyan-400" />
              </div>
              <div
                className="flex items-center gap-2 rounded-xl px-4 py-2.5"
                style={{ background: "var(--surface-glass)", border: "1px solid var(--hairline-default)" }}
              >
                <Loader2 size={14} className="animate-spin text-cyan-400" />
                <span className="text-xs font-medium text-slate-400">Analyzing neural patterns…</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Prompt Chips */}
      <div className="border-t border-slate-700/30 px-5 py-2.5">
        <PromptChips
          suggestions={[
            "Analyze my current brain state",
            "Why is my stress high?",
            "Generate a recovery protocol",
            "Explain my EEG bands",
          ]}
          onSelect={submitPrompt}
          disabled={isThinking}
        />
      </div>

      {/* Input */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submitPrompt(input);
        }}
        className="flex items-center gap-2 border-t border-slate-700/30 p-4"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about your brain health…"
          disabled={isThinking}
          className="flex-1 rounded-xl border border-base-border bg-base-overlay/40 px-4 py-2.5 text-sm text-white placeholder-slate-500 transition-all duration-300 focus:border-cyan-500/50 focus:outline-none focus:ring-1 focus:ring-cyan-500/20"
          style={{ transitionTimingFunction: "var(--ease-out-expo)" }}
        />
        <button
          type="submit"
          disabled={isThinking || !input.trim()}
          className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl transition-all duration-300 hover:shadow-glow-cyan disabled:opacity-40"
          style={{
            background: "linear-gradient(135deg, #06B6D4, #8B5CF6)",
            transitionTimingFunction: "var(--ease-out-expo)",
          }}
        >
          <Send size={16} className="text-white" />
        </button>
      </form>
    </div>
    </div>
  );
}
