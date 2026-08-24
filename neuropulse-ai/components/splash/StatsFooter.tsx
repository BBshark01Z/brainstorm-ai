"use client";

import { useEffect, useRef, useState } from "react";
import { useLanguage } from "@/hooks/useLanguageContext";

// ---------------------------------------------------------------------------
// StatsFooter — count-up stats pulled from REAL, verified app/DB figures.
//   - 5 frequency bands (delta/theta/alpha/beta/gamma)  — WebSocket payload
//   - 20 reference subjects                            — eeg_reference_data
//   - 54,587 reference samples                         — eeg_reference_data
//   - 300 ms stream refresh                            — DEMO_TICK_INTERVAL_S
// Counts up on first viewport entry; honors prefers-reduced-motion.
// ---------------------------------------------------------------------------

const STATS = [
  { value: 5, format: (v: number) => String(v), labelKey: "stat.bands", source: "δ θ α β γ" },
  { value: 20, format: (v: number) => String(v), labelKey: "stat.subjects", source: "eeg_reference_data" },
  { value: 54587, format: (v: number) => v.toLocaleString("en-US"), labelKey: "stat.samples", source: "healthy + patient" },
  { value: 300, format: (v: number) => `${v}ms`, labelKey: "stat.refresh", source: "WebSocket tick" },
];

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** Ease-out count toward `target` over ~1.1s once visible. */
function useCountUp(target: number, active: boolean) {
  const [val, setVal] = useState(0);

  useEffect(() => {
    if (!active) return;
    if (prefersReducedMotion()) {
      setVal(target);
      return;
    }
    const duration = 1100;
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3); // ease-out cubic
      setVal(Math.round(target * eased));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, active]);

  return val;
}

function Stat({ stat }: { stat: (typeof STATS)[number] }) {
  const { t } = useLanguage();
  const ref = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);
  const val = useCountUp(stat.value, inView);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          obs.disconnect();
        }
      },
      { threshold: 0.4 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    <div ref={ref} className="flex min-w-0 flex-col items-start gap-1">
      <div className="font-display text-2xl font-semibold text-slate-100 sm:text-3xl">
        {stat.format(val)}
      </div>
      <div className="text-xs uppercase tracking-wider text-slate-500">{t(stat.labelKey)}</div>
      <div className="font-mono text-[10px] leading-snug text-slate-600">{stat.source}</div>
    </div>
  );
}

export function StatsFooter() {
  return (
    // 2×2 grid: the splash hero's left column is narrow on desktop, and 4
    // columns there would shrink each cell below the width of longer values
    // ("54,587") and overflow into the neighbor — so two columns keeps every
    // stat and its sub-label cleanly separated at any viewport.
    <div className="grid grid-cols-2 gap-x-6 gap-y-7 border-t border-slate-700/20 pt-6">
      {STATS.map((s) => (
        <Stat key={s.labelKey} stat={s} />
      ))}
    </div>
  );
}