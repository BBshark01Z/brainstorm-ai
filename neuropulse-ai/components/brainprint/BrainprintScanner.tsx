"use client";

import { Fingerprint, ScanLine, Loader2, CheckCircle2 } from "lucide-react";
import clsx from "clsx";
import { ScanStatus } from "@/hooks/useBrainprintScan";
import { GlowPanel } from "@/components/ui/primitives";

export function BrainprintScanner({
  status,
  progress,
  onStart,
  subjectIndex,
  setSubjectIndex,
  subjects,
}: {
  status: ScanStatus;
  progress: number;
  onStart: () => void;
  subjectIndex: number;
  setSubjectIndex: (i: number) => void;
  subjects: { id: number; label: string }[];
}) {
  const isScanning = status === "scanning";
  const isProcessing = status === "processing";
  const isActive = isScanning || isProcessing;
  const isCaptured = status === "captured";

  const currentSubject = subjects[subjectIndex] ?? subjects[0];

  return (
    <GlowPanel glow="purple" className="flex flex-col items-center gap-6 py-10 text-center">
      <div className="relative flex h-40 w-40 items-center justify-center">
        {isScanning &&
          [0, 0.5, 1].map((delay) => (
            <span
              key={delay}
              className="absolute inset-0 rounded-full border border-neural/50 animate-pulse-ring"
              style={{ animationDelay: `${delay}s` }}
            />
          ))}
        <div
          className={clsx(
            "relative flex h-24 w-24 items-center justify-center rounded-full border-2 transition-colors",
            isActive || isCaptured ? "border-neural bg-neural/10" : "border-base-border bg-base-overlay"
          )}
        >
          {isProcessing ? (
            <Loader2 size={32} className="animate-spin text-neural" />
          ) : isCaptured ? (
            <CheckCircle2 size={32} className="text-neon" />
          ) : (
            <Fingerprint size={32} className={isActive ? "text-neural" : "text-ink-faint"} />
          )}
        </div>
      </div>

      <div>
        <p className="font-display text-sm font-semibold text-ink">
          {isScanning
            ? "Capturing Neural Signature..."
            : isProcessing
            ? "Matching against Brainprint database..."
            : isCaptured
            ? "Signature Captured"
            : "Ready to Scan"}
        </p>
        <p className="mt-1 text-xs text-ink-faint">
          {isActive
            ? "Hold still — reading frontal & temporal electrode activity"
            : isCaptured
            ? "See the result panel to the right"
            : "Place the headset and start a verification scan"}
        </p>
      </div>

      {isScanning && (
        <div className="w-full max-w-xs">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-base-overlay">
            <div
              className="h-full rounded-full bg-neural transition-[width] duration-100"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      {!isActive && (
        <button
          onClick={onStart}
          className="flex items-center gap-2 rounded-lg bg-neural px-5 py-2.5 text-sm font-medium text-white shadow-glow-purple transition-opacity duration-300 hover:opacity-90"
            style={{ transitionTimingFunction: "var(--ease-out-expo)" }}
        >
          <ScanLine size={16} />
          {status === "idle" ? "Start Verification Scan" : "Scan Again"}
        </button>
      )}

      {!isActive && (
        <label className="flex flex-col items-center gap-1.5 text-xs text-ink-faint">
          <span>Simulated subject</span>
          <select
            value={subjectIndex}
            onChange={(e) => setSubjectIndex(Number(e.target.value))}
            className="rounded-lg border border-base-border bg-base-overlay px-3 py-1.5 text-sm text-ink outline-none focus:border-neural"
          >
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
      )}

      {subjectIndex !== undefined && isActive && (
        <p className="text-xs text-ink-faint">
          Scanning as {currentSubject.label}
        </p>
      )}
    </GlowPanel>
  );
}
