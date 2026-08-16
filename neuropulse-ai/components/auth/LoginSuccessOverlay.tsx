"use client";

import { useEffect, useState, useRef } from "react";
import confetti from "canvas-confetti";

// ---------------------------------------------------------------------------
// LoginSuccessOverlay — Cyberpunk laser scan + biometric ring animation
//
// Plays when user successfully authenticates:
//  1. Laser scan sweep across screen
//  2. Biometric target ring pulses and says "AUTHENTICATED"
//  3. Particle spark burst
//  4. Fades out after ~2.5s then calls onComplete
// ---------------------------------------------------------------------------

interface LoginSuccessOverlayProps {
  onComplete: () => void;
}

export function LoginSuccessOverlay({ onComplete }: LoginSuccessOverlayProps) {
  const [phase, setPhase] = useState<0 | 1 | 2 | 3>(0);
  const [opacity, setOpacity] = useState(1);
  const timeoutRef = useRef<number[]>([]);

  // Schedule phase transitions
  useEffect(() => {
    const delays = [0, 400, 800, 2000];
    const labels: Array<0 | 1 | 2 | 3> = [0, 1, 2, 3];

    delays.forEach((d, i) => {
      if (i === 0) {
        setPhase(labels[i]);
        return;
      }
      const t = window.setTimeout(() => setPhase(labels[i]), d);
      timeoutRef.current.push(t);
    });

    // Fade out and complete
    const fadeT = window.setTimeout(() => {
      setOpacity(0);
    }, 2200);
    timeoutRef.current.push(fadeT);

    const doneT = window.setTimeout(() => {
      onComplete();
    }, 2800);
    timeoutRef.current.push(doneT);

    return () => {
      timeoutRef.current.forEach(clearTimeout);
    };
  }, [onComplete]);

  // Confetti burst at phase 2
  useEffect(() => {
    if (phase !== 2) return;
    const colors = ["#06B6D4", "#22D3EE", "#8B5CF6", "#A78BFA", "#00FF87"];
    confetti({
      particleCount: 80,
      spread: 70,
      startVelocity: 30,
      origin: { y: 0.6 },
      colors: colors,
      gravity: 0.8,
      ticks: 200,
    });
  }, [phase]);

  const isDark = true;

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-[#0A0F1D]"
      style={{
        opacity: opacity,
        transition: "opacity 0.6s ease",
      }}
    >
      {/* Laser scan line */}
      {(phase === 0 || phase === 1 || phase === 2) && (
        <div
          className="absolute left-0 right-0 h-1"
          style={{
            background: "linear-gradient(90deg, transparent, #06B6D4, #22D3EE, #06B6D4, transparent)",
            boxShadow: "0 0 30px 10px rgba(6, 182, 212, 0.5), 0 0 60px 20px rgba(6, 182, 212, 0.2)",
            animation: "scan-sweep 1.5s ease-in-out",
          }}
        />
      )}

      {/* Scan grid overlay */}
      {(phase === 0 || phase === 1) && (
        <div
          className="absolute inset-0 opacity-10"
          style={{
            backgroundImage:
              "linear-gradient(rgba(6,182,212,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(6,182,212,0.3) 1px, transparent 1px)",
            backgroundSize: "40px 40px",
          }}
        />
      )}

      {/* Biometric target ring */}
      {(phase === 1 || phase === 2) && (
        <div className="relative flex items-center justify-center">
          {/* Outer ring */}
          <div
            className="absolute rounded-full border"
            style={{
              width: "220px",
              height: "220px",
              borderColor: "rgba(6, 182, 212, 0.2)",
              animation: "pulse-ring 2s cubic-bezier(0.2, 0.6, 0.4, 1) infinite",
            }}
          />
          {/* Middle ring */}
          <div
            className="absolute rounded-full border"
            style={{
              width: "170px",
              height: "170px",
              borderColor: "rgba(6, 182, 212, 0.35)",
              animation: "pulse-ring 2s cubic-bezier(0.2, 0.6, 0.4, 1) infinite 0.3s",
            }}
          />
          {/* Inner ring */}
          <div
            className="absolute rounded-full border-2"
            style={{
              width: "120px",
              height: "120px",
              borderColor: phase === 2 ? "#00FF87" : "#06B6D4",
              boxShadow: phase === 2
                ? "0 0 30px rgba(0, 255, 135, 0.5)"
                : "0 0 20px rgba(6, 182, 212, 0.4)",
              animation: "pulse-ring 2s cubic-bezier(0.2, 0.6, 0.4, 1) infinite 0.6s",
            }}
          />

          {/* Crosshair lines */}
          <div className="absolute h-px w-full" style={{ background: "rgba(6, 182, 212, 0.15)" }} />
          <div className="absolute w-px bg-[rgba(6,182,212,0.15)]" style={{ height: "100%" }} />

          {/* Center icon / text */}
          <div className="relative z-10 flex flex-col items-center">
            {phase === 1 ? (
              <div className="text-xs font-mono text-cyan-400 animate-pulse">SCANNING</div>
            ) : (
              <>
                {/* Checkmark */}
                <svg width="32" height="32" viewBox="0 0 32 32" fill="none" className="mb-1">
                  <path
                    d="M8 16 L14 22 L24 10"
                    stroke="#00FF87"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    style={{ animation: "scan-sweep 0.5s ease-out" }}
                  />
                </svg>
                <div
                  className="text-sm font-bold font-mono tracking-[0.3em]"
                  style={{ color: "#00FF87", textShadow: "0 0 20px rgba(0,255,135,0.6)" }}
                >
                  AUTHENTICATED
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Particle sparks at phase 2 */}
      {phase === 2 && (
        <div className="absolute inset-0 pointer-events-none">
          {Array.from({ length: 12 }).map((_, i) => {
            const angle = (i / 12) * Math.PI * 2;
            const dist = 80 + Math.random() * 60;
            const cx = Math.cos(angle) * dist;
            const cy = Math.sin(angle) * dist;
            return (
              <div
                key={i}
                className="absolute left-1/2 top-1/2 h-1.5 w-1.5 rounded-full"
                style={{
                  background: i % 2 === 0 ? "#06B6D4" : "#8B5CF6",
                  boxShadow: "0 0 8px " + (i % 2 === 0 ? "rgba(6,182,212,0.8)" : "rgba(139,92,246,0.8)"),
                  transform: "translate(" + cx + "px, " + cy + "px)",
                  animation: "flicker " + (0.4 + Math.random() * 0.6) + "s ease-in-out infinite",
                  animationDelay: (Math.random() * 0.5) + "s",
                }}
              />
            );
          })}
        </div>
      )}

      {/* Corner brackets */}
      {(phase === 1 || phase === 2) && (
        <>
          <div className="absolute left-8 top-8 h-8 w-8 border-l-2 border-t-2 border-cyan-400/40" />
          <div className="absolute right-8 top-8 h-8 w-8 border-r-2 border-t-2 border-cyan-400/40" />
          <div className="absolute left-8 bottom-8 h-8 w-8 border-l-2 border-b-2 border-cyan-400/40" />
          <div className="absolute right-8 bottom-8 h-8 w-8 border-r-2 border-b-2 border-cyan-400/40" />
        </>
      )}
    </div>
  );
}
