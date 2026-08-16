"use client";

import { useEffect, useState } from "react";
import { EEGSample, InputMode } from "@/lib/types";
import { deriveMetrics } from "@/lib/mockData";
import { useFileIngestion } from "./useFileIngestion";
import { useWebSocketStream } from "./useWebSocketStream";

const BUFFER_SIZE = 60;

/**
 * Single seam the rest of the UI depends on. Regardless of which input mode
 * (file or WebSocket) is active, this returns the same `{ buffer, metrics,
 * latestSample }` shape the waveform chart, metric cards, and brainprint
 * capture already expect — so switching input modes never requires
 * touching downstream components.
 */
export function useDataSource(mode: InputMode) {
  const [buffer, setBuffer] = useState<EEGSample[]>([]);

  const fileIngestion = useFileIngestion(mode === "file");
  const webSocket = useWebSocketStream(mode === "websocket");

  const activeSample: EEGSample | null =
    mode === "file" ? fileIngestion.sample : webSocket.sample;

  useEffect(() => {
    if (!activeSample) return;
    setBuffer((prev) => {
      const next = [...prev, activeSample];
      return next.length > BUFFER_SIZE ? next.slice(-BUFFER_SIZE) : next;
    });
  }, [activeSample]);

  // Clear the buffer on mode switch so old-source samples don't linger on the chart.
  useEffect(() => {
    setBuffer([]);
  }, [mode]);

  const metrics = activeSample
    ? deriveMetrics(activeSample)
    : { focusScore: 0, stressLevel: 0, mentalFatigue: 0, faaIndex: 0 };

  return {
    buffer,
    metrics,
    latestSample: buffer[buffer.length - 1] ?? null,
    fileIngestion,
    webSocket,
  };
}
