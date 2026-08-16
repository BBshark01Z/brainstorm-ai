"use client";

import { useRef, useState } from "react";
import { Activity, Fingerprint, Bot, LineChart } from "lucide-react";

// ---------------------------------------------------------------------------
// BentoFeatureCards — 3D tilt + conic glow border on hover
//
// Four cards in a bento grid layout:
//  1. Wide: Real-time 5-Band EEG Waveform Monitor
//  2. Medium: Brainprint Biometric Security
//  3. Medium: DeepSeek AI Consultant Preview
//  4. Large: Longitudinal Burnout & Recovery Index
// ---------------------------------------------------------------------------

interface TiltCardProps {
  children: React.ReactNode;
  className?: string;
  glowColor?: string;
}

function TiltCard({ children, className = "", glowColor = "rgba(6, 182, 212, 0.3)" }: TiltCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    setTilt({ x: y * -8, y: x * 8 });
  };

  const handleMouseLeave = () => {
    setTilt({ x: 0, y: 0 });
  };

  return (
    <div
      ref={cardRef}
      className={"relative overflow-hidden rounded-2xl border border-slate-700/30 transition-shadow duration-500 hover:shadow-[0_0_40px_-10px_" + glowColor + "] " + className}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{
        transform: "perspective(800px) rotateX(" + tilt.x + "deg) rotateY(" + tilt.y + "deg)",
        transition: "transform 0.15s ease-out",
      }}
    >
      {/* Rotating conic glow border */}
      <div
        className="absolute -inset-[2px] rounded-2xl opacity-0 transition-opacity duration-500 hover:opacity-100"
        style={{
          background: "conic-gradient(from 0deg, transparent, " + glowColor + ", transparent, " + glowColor + ", transparent)",
          animation: "spin 4s linear infinite",
          zIndex: -1,
        }}
      />

      {/* Card content */}
      <div className="relative h-full">{children}</div>
    </div>
  );
}

function MiniWaveform() {
  // Simulated mini EEG waveform bars
  const bars = [30, 45, 20, 55, 35, 60, 25, 40, 50, 30, 45, 20, 55, 35, 60, 25];
  return (
    <div className="flex items-end gap-[2px] h-12">
      {bars.map((h, i) => (
        <div
          key={i}
          className="w-1.5 rounded-full bg-cyan-400/60"
          style={{
            height: h + "%",
            animation: "flicker " + (0.8 + Math.random() * 0.8) + "s ease-in-out infinite",
            animationDelay: (i * 0.1) + "s",
          }}
        />
      ))}
    </div>
  );
}

function MiniScanRing() {
  return (
    <div className="relative flex items-center justify-center h-12">
      <div className="absolute h-10 w-10 rounded-full border border-emerald-400/40" />
      <div
        className="absolute h-7 w-7 rounded-full border border-emerald-400/60"
        style={{ animation: "spin 3s linear infinite" }}
      />
      <div className="h-4 w-4 rounded-full bg-emerald-400/80" style={{ boxShadow: "0 0 10px rgba(52,211,153,0.6)" }} />
    </div>
  );
}

function MiniChatPreview() {
  return (
    <div className="space-y-2">
      <div className="rounded-lg bg-slate-700/40 px-3 py-1.5 text-[10px] text-slate-300 max-w-[80%]">
        Based on your alpha asymmetry...
      </div>
      <div className="rounded-lg bg-cyan-900/30 px-3 py-1.5 text-[10px] text-cyan-300 ml-auto max-w-[85%]">
        Show me the trend for last month
      </div>
      <div className="rounded-lg bg-slate-700/40 px-3 py-1.5 text-[10px] text-slate-300 max-w-[80%]">
        Here is your burnout recovery index...
      </div>
    </div>
  );
}

function MiniTrendChart() {
  const points = [
    "0,30", "10,25", "20,28", "30,20", "40,18", "50,22", "60,15", "70,12", "80,14", "90,10", "100,8"
  ];
  return (
    <svg viewBox="0 0 100 40" className="h-12 w-full" preserveAspectRatio="none">
      <defs>
        <linearGradient id="trendGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#8B5CF6" stopOpacity="0.3" />
          <stop offset="100%" stopColor="#8B5CF6" stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={"0,40 " + points.join(" ") + " 100,40"} fill="url(#trendGrad)" />
      <polyline
        points={points.join(" ")}
        fill="none"
        stroke="#8B5CF6"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function BentoFeatureCards() {
  return (
    <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
      <div className="mb-10 text-center">
        <h2 className="font-display text-2xl font-semibold text-slate-100 sm:text-3xl">
          Platform Capabilities
        </h2>
        <p className="mt-2 text-sm text-slate-400 sm:text-base">
          Real-time neural monitoring, biometric security, and AI insights
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 lg:grid-rows-2" style={{ gridAutoRows: "minmax(180px, auto)" }}>
        {/* Card 1: Wide - EEG Waveform (spans 2 cols) */}
        <TiltCard glowColor="rgba(6, 182, 212, 0.3)" className="sm:col-span-2 lg:row-span-1">
          <div className="flex h-full flex-col justify-between p-5" style={{ background: "linear-gradient(135deg, rgba(15,23,42,0.9), rgba(15,23,42,0.7))" }}>
            <div className="flex items-start justify-between">
              <div>
                <div className="mb-2 flex items-center gap-2">
                  <Activity size={16} className="text-cyan-400" />
                  <span className="text-xs font-mono uppercase tracking-wider text-slate-400">Live Monitor</span>
                </div>
                <h3 className="text-base font-semibold text-slate-100 sm:text-lg">5-Band EEG Waveform</h3>
              </div>
              <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-400">
                LIVE
              </span>
            </div>
            <MiniWaveform />
            <div className="mt-3 flex gap-2 text-[10px] font-mono text-slate-500">
              <span>DEL</span>
              <span className="text-slate-600">|</span>
              <span>THR</span>
              <span className="text-slate-600">|</span>
              <span>ALP</span>
              <span className="text-slate-600">|</span>
              <span>BET</span>
              <span className="text-slate-600">|</span>
              <span>GAM</span>
            </div>
          </div>
        </TiltCard>

        {/* Card 2: Medium - Brainprint */}
        <TiltCard glowColor="rgba(0, 255, 135, 0.3)" className="sm:col-span-1">
          <div className="flex h-full flex-col justify-between p-5" style={{ background: "linear-gradient(135deg, rgba(15,23,42,0.9), rgba(15,23,42,0.7))" }}>
            <div>
              <div className="mb-2 flex items-center gap-2">
                <Fingerprint size={16} className="text-emerald-400" />
                <span className="text-xs font-mono uppercase tracking-wider text-slate-400">Security</span>
              </div>
              <h3 className="text-base font-semibold text-slate-100 sm:text-lg">Brainprint</h3>
            </div>
            <div className="flex items-center justify-between">
              <MiniScanRing />
              <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-400">
                VERIFIED
              </span>
            </div>
          </div>
        </TiltCard>

        {/* Card 3: Medium - AI Consultant */}
        <TiltCard glowColor="rgba(139, 92, 246, 0.3)" className="sm:col-span-1">
          <div className="flex h-full flex-col justify-between p-5" style={{ background: "linear-gradient(135deg, rgba(15,23,42,0.9), rgba(15,23,42,0.7))" }}>
            <div>
              <div className="mb-2 flex items-center gap-2">
                <Bot size={16} className="text-violet-400" />
                <span className="text-xs font-mono uppercase tracking-wider text-slate-400">AI</span>
              </div>
              <h3 className="text-base font-semibold text-slate-100 sm:text-lg">DeepSeek Consultant</h3>
            </div>
            <MiniChatPreview />
          </div>
        </TiltCard>

        {/* Card 4: Large - Burnout & Recovery (spans 2 cols) */}
        <TiltCard glowColor="rgba(139, 92, 246, 0.3)" className="sm:col-span-2">
          <div className="flex h-full flex-col justify-between p-5" style={{ background: "linear-gradient(135deg, rgba(15,23,42,0.9), rgba(15,23,42,0.7))" }}>
            <div className="flex items-start justify-between">
              <div>
                <div className="mb-2 flex items-center gap-2">
                  <LineChart size={16} className="text-violet-400" />
                  <span className="text-xs font-mono uppercase tracking-wider text-slate-400">Analytics</span>
                </div>
                <h3 className="text-base font-semibold text-slate-100 sm:text-lg">Burnout & Recovery Index</h3>
              </div>
              <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-400">
                IMPROVING
              </span>
            </div>
            <MiniTrendChart />
            <div className="mt-3 grid grid-cols-3 gap-3 text-center">
              <div>
                <div className="text-lg font-semibold text-violet-400">72</div>
                <div className="text-[10px] text-slate-500">Recovery</div>
              </div>
              <div>
                <div className="text-lg font-semibold text-amber-400">23</div>
                <div className="text-[10px] text-slate-500">Burnout Risk</div>
              </div>
              <div>
                <div className="text-lg font-semibold text-cyan-400">+18%</div>
                <div className="text-[10px] text-slate-500">Trend</div>
              </div>
            </div>
          </div>
        </TiltCard>
      </div>
    </section>
  );
}
