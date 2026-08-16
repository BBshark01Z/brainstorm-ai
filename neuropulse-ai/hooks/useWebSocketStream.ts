"use client";

import { useState } from "react";
import { EEGSample, WebSocketConnectionState } from "@/lib/types";
import { useEEGContext } from "./useEEGContext";
import { getBackendWsUrl } from "@/lib/getBackendUrl";

/**
 * Derives a user-friendly connection state string from the raw
 * WebSocket readyState constant provided by useEEGContext.
 *
 * Mirrors the original useWebSocketStream behavior so downstream
 * components (ConnectionStatusWidget, MetricCard, etc.) see the
 * same labels regardless of which hook they call.
 */
function readyStateToConnectionLabel(state: number): WebSocketConnectionState {
  if (state === WebSocket.OPEN) return "connected";
  if (state === WebSocket.CONNECTING) return "connecting";
  return "disconnected";
}

/**
 * Reads the single WebSocket connection managed by EEGProvider
 * (useEEGContext) and exposes a compatible interface so that
 * useDataSource and downstream components work without changes.
 *
 * This hook does NOT create its own WebSocket — it delegates to
 * the provider to avoid duplicate connections.
 */
export function useWebSocketStream(active: boolean) {
  // Always call at top level — Rules of Hooks
  const eegCtx = useEEGContext();
  const [url, setUrl] = useState<string>(getBackendWsUrl());

  // Only expose data when active; otherwise return idle state.
  // This lets the dashboard toggle the connection on/off via
  // the input mode toggle (file ↔ websocket).
  if (!active) {
    return {
      url,
      setUrl,
      connectionState: "disconnected" as WebSocketConnectionState,
      sample: null as EEGSample | null,
      lastError: null as string | null,
      connect: () => {},
      disconnect: () => {},
    };
  }

  const connectionState = readyStateToConnectionLabel(eegCtx.wsReadyState);

  // Derive lastError from context state
  const lastError =
    eegCtx.connectionLabel === "Connecting..."
      ? "Connecting to backend..."
      : eegCtx.connectionLabel === "Disconnected"
        ? "Backend unreachable — is it running on port 8765?"
        : null;

  return {
    url,
    setUrl,
    connectionState,
    sample: eegCtx.latestSample,
    lastError,
    connect: eegCtx.reconnect,
    disconnect: eegCtx.disconnect,
  };
}
