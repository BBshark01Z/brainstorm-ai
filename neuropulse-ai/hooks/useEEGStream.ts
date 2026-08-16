"use client";

import { useEffect, useRef, useState } from "react";
import { EEGSample, DerivedMetrics } from "@/lib/types";
import { generateEEGSample, deriveMetrics } from "@/lib/mockData";

const BUFFER_SIZE = 60; // ~9s of history at 150ms/sample — enough for a live waveform
const SAMPLE_INTERVAL_MS = 150;

/**
 * Simulates a real-time EEG headset stream.
 *
 * In production, replace the `setInterval` body with your hardware SDK's
 * subscription callback (e.g. `headset.onSample((sample) => ...)`) — the
 * rest of this hook (buffering, metric derivation) can stay as-is.
 */
export function useEEGStream(isStreaming: boolean = true) {
  const [buffer, setBuffer] = useState<EEGSample[]>([]);
  const [metrics, setMetrics] = useState<DerivedMetrics>({
    focusScore: 0,
    stressLevel: 0,
    mentalFatigue: 0,
    faaIndex: 0,
  });
  const elapsedRef = useRef(0);

  useEffect(() => {
    if (!isStreaming) return;

    const intervalId = setInterval(() => {
      elapsedRef.current += SAMPLE_INTERVAL_MS / 1000;
      const sample = generateEEGSample(elapsedRef.current);

      setBuffer((prev) => {
        const next = [...prev, sample];
        return next.length > BUFFER_SIZE ? next.slice(-BUFFER_SIZE) : next;
      });
      setMetrics(deriveMetrics(sample));
    }, SAMPLE_INTERVAL_MS);

    return () => clearInterval(intervalId);
  }, [isStreaming]);

  return { buffer, metrics, latestSample: buffer[buffer.length - 1] };
}
