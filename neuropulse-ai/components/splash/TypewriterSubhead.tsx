"use client";

import { useTypewriter } from "@/hooks/useTypewriter";

// ---------------------------------------------------------------------------
// TypewriterSubhead — the splash subhead is typed out on load (Option B copy),
// then the caret keeps blinking. Falls back to instant render under
// prefers-reduced-motion.
// ---------------------------------------------------------------------------

export function TypewriterSubhead() {
  const subhead =
    "An experimental platform for EEG monitoring, brain-print verification, and AI-driven analysis — built on simulated reference data for research, not clinical use.";
  const { display, done } = useTypewriter(subhead, {});

  return (
    <p
      className={`type-caret mt-5 max-w-xl text-base leading-relaxed text-slate-400 sm:text-lg ${
        done ? "" : "text-slate-300/90"
      }`}
      aria-label={subhead}
      role="text"
    >
      {display}
    </p>
  );
}