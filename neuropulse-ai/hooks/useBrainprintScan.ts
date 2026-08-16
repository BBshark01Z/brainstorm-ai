"use client";

import { useCallback, useRef, useState } from "react";
import {
  SIMULATED_SUBJECTS,
  SimulatedSubject,
  simulateSubjectCapture,
} from "@/lib/brainprintUtils";

const SCAN_DURATION_MS = 2600;
const PROCESSING_DURATION_MS = 900;

export type ScanStatus = "idle" | "scanning" | "processing" | "captured";

/**
 * Owns only the capture timing/animation + which simulated subject is being
 * scanned — NOT the recognition decision. Once a scan completes,
 * `capturedVector` is populated and the caller (BrainprintView) runs it
 * through the backend verify endpoint.
 *
 * The capture is generated per-subject (see `simulateSubjectCapture`):
 * re-scanning the selected subject yields a very similar vector (so it verifies
 * as that subject), while different subjects yield near-orthogonal vectors (so
 * they don't spuriously match an unrelated enrolled profile).
 */
export function useBrainprintScan() {
  const [status, setStatus] = useState<ScanStatus>("idle");
  const [progress, setProgress] = useState(0);
  const [capturedVector, setCapturedVector] = useState<number[] | null>(null);
  const [subjectIndex, setSubjectIndex] = useState(0);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  const clearTimers = () => {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
  };

  const startScan = useCallback(() => {
    clearTimers();
    setStatus("scanning");
    setProgress(0);
    setCapturedVector(null);

    const startedAt = Date.now();
    const tick = () => {
      const pct = Math.min(100, ((Date.now() - startedAt) / SCAN_DURATION_MS) * 100);
      setProgress(pct);
      if (pct < 100) timersRef.current.push(setTimeout(tick, 60));
    };
    tick();

    timersRef.current.push(
      setTimeout(() => {
        setStatus("processing");
        timersRef.current.push(
          setTimeout(() => {
            const vector = simulateSubjectCapture(subjectIndex);
            setCapturedVector(vector);
            setStatus("captured");
          }, PROCESSING_DURATION_MS)
        );
      }, SCAN_DURATION_MS)
    );
  }, [subjectIndex]);

  const reset = useCallback(() => {
    clearTimers();
    setStatus("idle");
    setProgress(0);
    setCapturedVector(null);
  }, []);

  const subjects: SimulatedSubject[] = SIMULATED_SUBJECTS;

  return {
    status,
    progress,
    capturedVector,
    subjectIndex,
    setSubjectIndex,
    subjects,
    startScan,
    reset,
  };
}
