"use client";

import { useState } from "react";
import { Activity, Fingerprint, LineChart, Bot } from "lucide-react";
import clsx from "clsx";

// ---------------------------------------------------------------------------
// FeaturePills — interactive feature-preview pills for the splash page.
// Hover / select a pill (Live Monitor, Brainprint, Analytics, AI Consultant)
// and a one-line description of that feature appears below.
// ---------------------------------------------------------------------------

const FEATURES = [
  {
    key: "monitor",
    label: "Live Monitor",
    icon: Activity,
    tagline: "Real-time EEG waveforms across five frequency bands on a live stream.",
  },
  {
    key: "brainprint",
    label: "Brainprint",
    icon: Fingerprint,
    tagline: "Biometric identity matching from neural features against enrolled profiles.",
  },
  {
    key: "analytics",
    label: "Analytics",
    icon: LineChart,
    tagline: "Longitudinal trends and baseline comparison against a 20-subject reference set.",
  },
  {
    key: "consultant",
    label: "AI Consultant",
    icon: Bot,
    tagline: "An AI neuro-consultant that interprets your signals and answers questions.",
  },
];

export function FeaturePills() {
  const [active, setActive] = useState<string>("monitor");
  const selected = FEATURES.find((f) => f.key === active)!;

  return (
    <div className="mt-8 w-full max-w-2xl">
      <div className="flex flex-wrap justify-center gap-2 sm:gap-3 lg:justify-start">
        {FEATURES.map(({ key, label, icon: Icon }) => {
          const isActive = active === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => setActive(key)}
              onMouseEnter={() => setActive(key)}
              onFocus={() => setActive(key)}
              className={clsx(
                "glass-pill flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium",
                isActive
                  ? "border-vital/50 text-vital shadow-glow-cyan"
                  : "text-slate-400 hover:text-slate-200"
              )}
              aria-pressed={isActive}
            >
              <Icon size={15} />
              {label}
            </button>
          );
        })}
      </div>

      {/* Description panel */}
      <div
        key={selected.key}
        className="rise-in mt-4 flex min-h-[3.25rem] items-center gap-3 rounded-xl px-4 py-3 glass"
        role="status"
      >
        <selected.icon size={16} className="shrink-0 text-neural" />
        <p className="text-sm text-slate-300">{selected.tagline}</p>
      </div>
    </div>
  );
}