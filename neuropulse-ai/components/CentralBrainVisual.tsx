"use client";

import dynamic from "next/dynamic";
import { Brain } from "lucide-react";

type BrainState = "focus" | "stress" | "sleep";

/**
 * Lazy-loaded interactive 3D brain hero visual.
 *
 * Three.js is loaded on demand (ssr:false) so it never blocks first paint or
 * bloats the initial bundle. Until it mounts we show a lightweight placeholder
 * that matches the same responsive slot/size as the previous visual, so the
 * layout does not jump.
 */

const StaticFallback = () => (
  <div className="relative flex h-64 w-64 items-center justify-center sm:h-80 sm:w-80 md:h-96 md:w-96">
    <div
      className="absolute inset-0 rounded-full"
      style={{
        background:
          "radial-gradient(circle, rgba(6,182,212,0.28) 0%, rgba(15,23,42,0) 70%)",
      }}
    />
    <Brain size={56} className="relative text-cyan-400/60" />
  </div>
);

const BrainVisual3D = dynamic(
  () =>
    import("@/components/landing/BrainVisual3D").then((m) => m.BrainVisual3D),
  {
    ssr: false,
    loading: () => <StaticFallback />,
  }
);

export function CentralBrainVisual({
  brainState = "focus",
  className = "",
}: {
  brainState?: BrainState;
  className?: string;
}) {
  return <BrainVisual3D brainState={brainState} className={className} />;
}