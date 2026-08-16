"use client";

import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { EEGSample, DerivedMetrics } from "@/lib/types";
import { getBackendWsUrl } from "@/lib/getBackendUrl";

// ---------------------------------------------------------------------------
// Helpers — mirror the same metric heuristics used in lib/mockData.ts so the
// AI consultant sees the same numbers regardless of whether the data comes
// from the mock simulator or the real WebSocket stream.
// ---------------------------------------------------------------------------

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));
const round2 = (value: number) => Math.round(value * 100) / 100;

function deriveMetricsFromSample(sample: EEGSample): DerivedMetrics {
  const engagementRatio = sample.beta / (sample.theta + sample.alpha);
  const focusScore = clamp(Math.round(engagementRatio * 140), 0, 100);

  const stressRatio = sample.beta / sample.alpha;
  const stressLevel = clamp(Math.round(stressRatio * 55), 0, 100);

  const thetaBetaRatio = sample.theta / sample.beta;
  const mentalFatigue = clamp(Math.round(thetaBetaRatio * 30), 0, 100);

  const faaIndex =
    sample.alphaF4 > 0 && sample.alphaF3 > 0
      ? round2(Math.log(sample.alphaF4) - Math.log(sample.alphaF3))
      : 0;

  return { focusScore, stressLevel, mentalFatigue, faaIndex };
}

// ---------------------------------------------------------------------------
// Context shape
// ---------------------------------------------------------------------------

export interface EEGContextValue {
  /** Latest single sample from the WebSocket stream. */
  latestSample: EEGSample | null;
  /** Rolling buffer of recent samples (last 60 ≈ 9 s at 150 ms/sample). */
  recentSamples: EEGSample[];
  /** Derived cognitive metrics computed from the latest sample. */
  metrics: DerivedMetrics;
  /** Raw WebSocket readyState constant. */
  wsReadyState: number;
  /** Human-readable connection label for the UI. */
  connectionLabel: string;
  /** Whether auto-reconnect is enabled (default: true). */
  autoReconnect: boolean;
  /** Toggle auto-reconnect on / off. */
  setAutoReconnect: (v: boolean) => void;
  /** Force a fresh connection attempt now (clears backoff/pending timers). */
  reconnect: () => void;
  /** Manually close the connection and pause auto-reconnect. */
  disconnect: () => void;
}

export const EEGContext = createContext<EEGContextValue>({
  latestSample: null,
  recentSamples: [],
  metrics: { focusScore: 0, stressLevel: 0, mentalFatigue: 0, faaIndex: 0 },
  wsReadyState: WebSocket.CLOSED,
  connectionLabel: "Disconnected",
  autoReconnect: true,
  setAutoReconnect: () => {},
  reconnect: () => {},
  disconnect: () => {},
});

const BUFFER_SIZE = 60;

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export function EEGProvider({
  children,
  wsUrl,
}: {
  children: ReactNode;
  wsUrl?: string;
}) {
  const [latestSample, setLatestSample] = useState<EEGSample | null>(null);
  const [recentSamples, setRecentSamples] = useState<EEGSample[]>([]);
  const [metrics, setMetrics] = useState<DerivedMetrics>({
    focusScore: 0,
    stressLevel: 0,
    mentalFatigue: 0,
    faaIndex: 0,
  });
  const [wsReadyState, setWsReadyState] = useState<number>(WebSocket.CLOSED);
  const [autoReconnect, setAutoReconnectState] = useState(true);
  const autoReconnectRef = useRef(true);

  const socketRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const maxReconnectAttempts = 50; // attempt up to 50 times (~8 min at 10s interval)
  const isUnmountedRef = useRef(false);
  const pingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Use explicit wsUrl prop → .env.local NEXT_PUBLIC_WS_URL → shared helper
  // (which defaults to 127.0.0.1:8765 for localhost).
  // NOTE: NEXT_PUBLIC_WS_URL is deprecated but still supported for backward
  // compatibility — if it's set, we use it directly; otherwise derive from
  // the shared helper.
  const url = wsUrl
    ?? (typeof process !== "undefined" ? process.env.NEXT_PUBLIC_WS_URL : undefined)
    ?? getBackendWsUrl();

  // Stable reference to doConnect — stored in a ref so that useCallback
  // dependencies on it don't cause cascading re-renders.
  const doConnectRef = useRef<() => void>();

  const doConnect = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.close();
    }

    const ws = new WebSocket(url);
    socketRef.current = ws;
    if (!isUnmountedRef.current) {
      setWsReadyState(WebSocket.CONNECTING);
    }

    ws.onopen = () => {
      if (isUnmountedRef.current) return;
      setWsReadyState(WebSocket.OPEN);
      // Reset reconnect counter on successful connect
      reconnectAttemptsRef.current = 0;

      // Start heartbeat — send PING every 15s while connected.
      // Backend expects PONG within 3 missed intervals (45s total) before disconnecting.
      pingIntervalRef.current = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          try {
            ws.send(JSON.stringify({ type: "ping" }));
          } catch {
            // Connection likely torn down — ignore, onclose will fire.
          }
        }
      }, 15000);
    };

    ws.onerror = () => {
      if (isUnmountedRef.current) return;
      // Don't set CLOSED on error — let onclose handle it.
      // This prevents a flicker where error → CLOSED → reconnecting.
    };

    ws.onclose = (event: CloseEvent) => {
      if (isUnmountedRef.current) return;
      setWsReadyState(WebSocket.CLOSED);
    };

    ws.onmessage = (event: MessageEvent) => {
      // Respond to backend PING with PONG (plain text frame).
      if (event.data === "PING") {
        try {
          ws.send("PONG");
        } catch {
          // Connection likely torn down — ignore.
        }
        return;
      }

      try {
        const raw = JSON.parse(event.data) as Record<string, unknown>;

        const sample: EEGSample = {
          timestamp: Date.now(),
          delta: typeof raw.delta === "number" ? raw.delta : 0,
          theta: typeof raw.theta === "number" ? raw.theta : 0,
          alpha: typeof raw.alpha === "number" ? raw.alpha : 0,
          beta: typeof raw.beta === "number" ? raw.beta : 0,
          gamma: typeof raw.gamma === "number" ? raw.gamma : 0,
          alphaF3:
            typeof raw.alphaF3 === "number"
              ? raw.alphaF3
              : typeof raw.alpha === "number"
                ? raw.alpha
                : 0,
          alphaF4:
            typeof raw.alphaF4 === "number"
              ? raw.alphaF4
              : typeof raw.alpha === "number"
                ? raw.alpha
                : 0,
        };

        const derived = deriveMetricsFromSample(sample);

        setLatestSample(sample);
        setMetrics(derived);
        setRecentSamples((prev) => {
          const next = [...prev, sample];
          return next.length > BUFFER_SIZE ? next.slice(-BUFFER_SIZE) : next;
        });
      } catch {
        // Ignore malformed frames — don't tear down the connection.
      }
    };
  }, [url]);

  // Keep a stable ref pointing at the latest doConnect so that other
  // useCallbacks (reconnect) can call it without listing doConnect in
  // their dependency arrays — which would cascade the same render-loop
  // problem.
  useEffect(() => {
    doConnectRef.current = doConnect;
  }, [doConnect]);

  // Auto-connect on mount; clean up on unmount.
  //
  // NOTE: dependency array is intentionally `[]` (empty). `doConnect` captures
  // everything it needs via closures (url, socketRef, isUnmountedRef, etc.)
  // and is wrapped in useCallback — but because it lives inside this component,
  // a fresh function reference is created on every render. Using [doConnect]
  // as a dependency would cause the effect to re-run on every render, which
  // tears down the WebSocket and creates an infinite mount→cleanup→mount loop.
  useEffect(() => {
    isUnmountedRef.current = false;
    doConnect();
    return () => {
      isUnmountedRef.current = true;
      reconnectTimerRef.current && clearTimeout(reconnectTimerRef.current);
      pingIntervalRef.current && clearInterval(pingIntervalRef.current);

      const ws = socketRef.current;
      if (ws) {
        // Prevent browser errors when React StrictMode/Fast Refresh triggers
        // cleanup while the handshake is still in progress.
        if (ws.readyState === WebSocket.CONNECTING) {
          ws.onopen = () => {
            ws.close();
          };
        } else if (ws.readyState === WebSocket.OPEN) {
          ws.close();
        }
        // CLOSED / CLOSING → nothing to do.
      }
      socketRef.current = null;
    };
  }, []);

  const handleSetAutoReconnect = useCallback((v: boolean) => {
    setAutoReconnectState(v);
    autoReconnectRef.current = v;
  }, []);

  // Manual "Connect" action — clears any pending backoff timer, resets the
  // attempt counter, and opens a fresh socket right away.
  const reconnect = useCallback(() => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
    reconnectAttemptsRef.current = 0;
    isUnmountedRef.current = false;
    doConnectRef.current?.();
  }, []);

  // Manual "Disconnect" action — pauses auto-reconnect and closes the
  // socket (or cancels it if it's still mid-handshake).
  const disconnect = useCallback(() => {
    autoReconnectRef.current = false;
    setAutoReconnectState(false);
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
    const ws = socketRef.current;
    if (ws) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.close();
      } else if (ws.readyState === WebSocket.CONNECTING) {
        ws.onopen = () => ws.close();
      }
    }
  }, []);

  const connectionLabel =
    wsReadyState === WebSocket.OPEN
      ? "Streaming"
      : wsReadyState === WebSocket.CONNECTING
        ? "Connecting..."
        : "Disconnected";

  return (
    <EEGContext.Provider
      value={{
        latestSample,
        recentSamples,
        metrics,
        wsReadyState,
        connectionLabel,
        autoReconnect,
        setAutoReconnect: handleSetAutoReconnect,
        reconnect,
        disconnect,
      }}
    >
      {children}
    </EEGContext.Provider>
  );
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useEEGContext(): EEGContextValue {
  const ctx = useContext(EEGContext);
  if (!ctx) {
    throw new Error("useEEGContext must be used within an EEGProvider");
  }
  return ctx;
}
