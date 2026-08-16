"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Brain, Shield, Activity, Cpu, Zap, ArrowRight } from "lucide-react";
import { CentralBrainVisual } from "@/components/CentralBrainVisual";
import { BentoFeatureCards } from "@/components/ui/BentoFeatureCards";
import { TypewriterSubhead } from "@/components/splash/TypewriterSubhead";
import { FeaturePills } from "@/components/splash/FeaturePills";
import { StatsFooter } from "@/components/splash/StatsFooter";

type BrainState = "focus" | "stress" | "sleep";

const BRAIN_STATES: { key: BrainState; label: string; color: string; icon: string }[] = [
  { key: "focus", label: "Focus", color: "#06B6D4", icon: "Zap" },
  { key: "stress", label: "Stress", color: "#EF4444", icon: "Activity" },
  { key: "sleep", label: "Sleep", color: "#8B5CF6", icon: "Cpu" },
];

export default function HomePage() {
  const [brainState, setBrainState] = useState<BrainState>("focus");
  const router = useRouter();

  return (
    <div className="relative min-h-screen overflow-hidden">
      {/* Ambient gradient overlay */}
      <div
        className="pointer-events-none fixed inset-0 z-0"
        style={{
          background: "radial-gradient(ellipse at 50% 0%, rgba(6,182,212,0.08) 0%, transparent 60%)",
        }}
      />

      {/* Navigation Bar */}
      <nav className="fixed left-0 right-0 top-0 z-50 glass border-b border-slate-700/20">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
          {/* Logo */}
          <div className="flex items-center gap-2">
            <div className="relative flex items-center justify-center">
              <Brain size={24} className="text-cyan-400" />
              <div
                className="absolute inset-0 rounded-full"
                style={{
                  background: "radial-gradient(circle, rgba(6,182,212,0.3) 0%, transparent 70%)",
                  animation: "pulse-ring 2.5s cubic-bezier(0.2, 0.6, 0.4, 1) infinite",
                }}
              />
            </div>
            <span className="font-display text-lg font-semibold text-slate-100">
              Brain<span className="text-cyan-400">storm</span> AI
            </span>
          </div>

          {/* Nav Links */}
          <div className="hidden items-center gap-6 md:flex">
            <a href="#features" className="text-sm text-slate-400 transition-colors hover:text-slate-200">
              Features
            </a>
            <a href="#demo" className="text-sm text-slate-400 transition-colors hover:text-slate-200">
              Live Demo
            </a>
            <a href="#about" className="text-sm text-slate-400 transition-colors hover:text-slate-200">
              About
            </a>
          </div>

          {/* CTA */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push("/login")}
              className="rounded-lg px-4 py-2 text-sm font-medium text-slate-300 transition-colors hover:text-white"
            >
              Sign In
            </button>
            <button
              onClick={() => router.push("/register")}
              className="rounded-lg bg-cyan-500/20 px-4 py-2 text-sm font-medium text-cyan-400 transition-all hover:bg-cyan-500/30 hover:shadow-glow-cyan"
            >
              Get Started
            </button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative z-10 pt-24 pb-12 sm:pt-32 sm:pb-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="flex flex-col items-center gap-8 lg:flex-row lg:gap-12">
            {/* Left: Text content */}
            <div className="flex flex-1 flex-col items-center text-center lg:items-start lg:text-left">
              {/* Floating badge */}
              <div
                className="mb-4 inline-flex items-center gap-2 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3 py-1 text-xs font-medium text-cyan-400"
                style={{ animation: "float 3s ease-in-out infinite" }}
              >
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75" style={{ animation: "pulse-ring 1.5s cubic-bezier(0.2, 0.6, 0.4, 1) infinite" }} />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-cyan-500" />
                </span>
                Experimental EEG Research Platform
              </div>

              {/* Headline */}
              <h1 className="font-display text-4xl font-bold leading-tight text-slate-100 sm:text-5xl lg:text-6xl">
                Where
                <br />
                <span className="gradient-text">Neural Signals</span>
                <br />
                Meet Identity
              </h1>

              {/* Typewriter subhead */}
              <TypewriterSubhead />

              {/* Interactive feature-preview pills */}
              <FeaturePills />

              {/* CTA buttons */}
              <div className="mt-8 flex flex-wrap justify-center gap-3 lg:justify-start">
                <button
                  onClick={() => router.push("/login")}
                  className="group flex items-center gap-2 rounded-xl bg-cyan-500 px-6 py-3 text-sm font-semibold text-slate-900 transition-all hover:bg-cyan-400 hover:shadow-glow-cyan"
                >
                  Continue to Login
                </button>
                <button
                  onClick={() => router.push("/register")}
                  className="flex items-center gap-2 rounded-xl border border-slate-600/50 bg-slate-800/50 px-6 py-3 text-sm font-semibold text-slate-300 backdrop-blur transition-all hover:border-slate-500/50 hover:bg-slate-700/50"
                >
                  Create account
                </button>
              </div>

              {/* Real-number stats */}
              <div className="mt-10 w-full max-w-xl">
                <StatsFooter />
              </div>
            </div>

            {/* Center: Brain visual */}
            <div className="flex flex-1 items-center justify-center">
              <CentralBrainVisual brainState={brainState} />
            </div>

            {/* Right: Live metrics cards */}
            <div className="flex flex-1 flex-col gap-3 lg:justify-center">
              {/* Focus Score */}
              <div className="glass-raised rounded-xl p-4 transition-all duration-500 hover:shadow-glow-cyan">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-xs font-mono text-slate-400">FOCUS SCORE</span>
                  <Activity size={14} className="text-cyan-400" />
                </div>
                <div className="flex items-end gap-2">
                  <span className="text-2xl font-bold text-slate-100">87</span>
                  <span className="mb-1 text-xs text-emerald-400">+12%</span>
                </div>
                <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-700/50">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-cyan-300 transition-all duration-1000"
                    style={{ width: "87%" }}
                  />
                </div>
              </div>

              {/* Stress Level */}
              <div className="glass-raised rounded-xl p-4 transition-all duration-500 hover:shadow-[0_0_30px_-10px_rgba(239,68,68,0.4)]">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-xs font-mono text-slate-400">STRESS LEVEL</span>
                  <Activity size={14} className="text-red-400" />
                </div>
                <div className="flex items-end gap-2">
                  <span className="text-2xl font-bold text-slate-100">23</span>
                  <span className="mb-1 text-xs text-emerald-400">-8%</span>
                </div>
                <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-700/50">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-red-500 to-red-300 transition-all duration-1000"
                    style={{ width: "23%" }}
                  />
                </div>
              </div>

              {/* Mental Clarity */}
              <div className="glass-raised rounded-xl p-4 transition-all duration-500 hover:shadow-glow-purple">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-xs font-mono text-slate-400">MENTAL CLARITY</span>
                  <Cpu size={14} className="text-violet-400" />
                </div>
                <div className="flex items-end gap-2">
                  <span className="text-2xl font-bold text-slate-100">74</span>
                  <span className="mb-1 text-xs text-emerald-400">+5%</span>
                </div>
                <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-700/50">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-violet-500 to-violet-300 transition-all duration-1000"
                    style={{ width: "74%" }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Interactive Demo Console */}
      <section id="demo" className="relative z-10 py-12 sm:py-16">
        <div className="mx-auto max-w-3xl px-4 sm:px-6">
          <div className="text-center">
            <h2 className="font-display text-2xl font-semibold text-slate-100 sm:text-3xl">
              Interactive Brain State Demo
            </h2>
            <p className="mt-2 text-sm text-slate-400">
              Switch states to see real-time color and animation changes
            </p>
          </div>

          {/* State switcher */}
          <div className="mt-8 flex justify-center gap-3">
            {BRAIN_STATES.map((state) => (
              <button
                key={state.key}
                onClick={() => setBrainState(state.key)}
                className="group flex items-center gap-2 rounded-xl border px-5 py-3 text-sm font-medium transition-all"
                style={{
                  borderColor: brainState === state.key ? state.color + "60" : "rgba(30,42,61,0.5)",
                  backgroundColor: brainState === state.key ? state.color + "15" : "rgba(15,23,42,0.6)",
                  boxShadow: brainState === state.key ? "0 0 20px -5px " + state.color + "40" : "none",
                }}
              >
                {state.key === "focus" && <Zap size={16} />}
                {state.key === "stress" && <Activity size={16} />}
                {state.key === "sleep" && <Cpu size={16} />}
                <span style={{ color: brainState === state.key ? state.color : "#8B96A8" }}>
                  {state.label}
                </span>
              </button>
            ))}
          </div>

          {/* Visual feedback */}
          <div className="mt-6 flex justify-center">
            <div
              className="h-1 w-32 rounded-full transition-all duration-700"
              style={{
                background: "linear-gradient(90deg, transparent, " + BRAIN_STATES.find((s) => s.key === brainState)?.color + ", transparent)",
                boxShadow: "0 0 15px " + BRAIN_STATES.find((s) => s.key === brainState)?.color + "40",
              }}
            />
          </div>
        </div>
      </section>

      {/* Bento Grid Features */}
      <section id="features">
        <BentoFeatureCards />
      </section>

      {/* Bottom CTA */}
      <section className="relative z-10 py-16 sm:py-24">
        <div className="mx-auto max-w-3xl px-4 text-center sm:px-6">
          <div className="glass-raised rounded-2xl border border-slate-600/20 p-8 sm:p-12">
            <Shield size={32} className="mx-auto mb-4 text-cyan-400" />
            <h2 className="font-display text-2xl font-semibold text-slate-100 sm:text-3xl">
              Ready to Explore Your Brain?
            </h2>
            <p className="mt-3 text-sm text-slate-400 sm:text-base">
              Join the future of neural monitoring. No hardware required - start with simulated data.
            </p>
            <button
              onClick={() => router.push("/register")}
              className="mt-6 inline-flex items-center gap-2 rounded-xl bg-cyan-500 px-8 py-3 text-sm font-semibold text-slate-900 transition-all hover:bg-cyan-400 hover:shadow-glow-cyan"
            >
              Create Your Account
              <ArrowRight size={16} />
            </button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 border-t border-slate-700/20 py-8">
        <div className="mx-auto max-w-7xl px-4 text-center sm:px-6">
          <p className="text-xs text-slate-500">
            Brainstorm — an experimental EEG research platform. All data is simulated
            reference data. Not a medical device.
          </p>
          <p className="mt-1 text-xs text-slate-600">
            Welcome page for Brainstorm. Continuing to login or register keeps using
            your authenticated account.
          </p>
        </div>
      </footer>
    </div>
  );
}
