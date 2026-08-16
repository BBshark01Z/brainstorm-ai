import type { Config } from "tailwindcss";

// ---------------------------------------------------------------------------
// NeuroPulse AI — "Midnight Blue Aesthetic" design tokens
// Palette: Midnight Blue base, Cyan/Teal accent, Violet/AI accent, Emerald
// for verified states, Amber/Red for risk alerts.
// ---------------------------------------------------------------------------

const config: Config = {
  darkMode: "class",
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
    "./hooks/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        midnight: {
          DEFAULT: "#0A0F1D", // page background
          50: "#0D1525",
          100: "#111B2F",
          200: "#162035",
        },
        base: {
          DEFAULT: "#0A0F1D", // page background
          raised: "#0E131F", // card surface
          overlay: "#141A28", // hover / nested surface
          border: "#1E2636", // hairline borders
        },
        ink: {
          DEFAULT: "#E6EDF7", // primary text
          muted: "#8B96A8", // secondary text
          faint: "#5B6478", // tertiary / disabled text
        },
        vital: {
          // live signal / oscilloscope accent — cyan
          DEFAULT: "#06B6D4",
          teal: "#14B8A6",
          dim: "#0E7490",
        },
        neon: {
          // "verified" / healthy states — emerald green
          DEFAULT: "#10B981",
          dim: "#059B52",
        },
        neural: {
          // AI / brainprint identity accent — violet
          DEFAULT: "#8B5CF6",
          indigo: "#6366F1",
          dim: "#4C1D95",
        },
        risk: {
          // burnout / alerts — red-orange
          amber: "#F59E0B",
          orange: "#FF6A3D",
          red: "#EF4444",
          dim: "#7C2D12",
        },
      },
      fontFamily: {
        display: ["var(--font-display)", "sans-serif"], // Space Grotesk — headings
        body: ["var(--font-body)", "sans-serif"], // Inter — UI copy
        mono: ["var(--font-mono)", "monospace"], // IBM Plex Mono — hashes, readouts
      },
      boxShadow: {
        "glow-cyan": "0 0 24px -4px rgba(6, 182, 212, 0.45)",
        "glow-purple": "0 0 24px -4px rgba(139, 92, 246, 0.45)",
        "glow-red": "0 0 24px -4px rgba(239, 68, 68, 0.45)",
        "glow-amber": "0 0 24px -4px rgba(245, 158, 11, 0.4)",
        "glow-emerald": "0 0 24px -4px rgba(16, 185, 129, 0.45)",
      },
      keyframes: {
        "pulse-ring": {
          "0%": { transform: "scale(0.6)", opacity: "0.8" },
          "80%": { opacity: "0" },
          "100%": { transform: "scale(1.6)", opacity: "0" },
        },
        "scan-sweep": {
          "0%": { transform: "translateY(-100%)" },
          "100%": { transform: "translateY(100%)" },
        },
        "flicker": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.55" },
        },
        "flash-alert": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.35" },
        },
        "gradient-shift": {
          "0%, 100%": { backgroundPosition: "0% 50%" },
          "50%": { backgroundPosition: "100% 50%" },
        },
        "float": {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-10px)" },
        },
      },
      animation: {
        "pulse-ring": "pulse-ring 2.2s cubic-bezier(0.2, 0.6, 0.4, 1) infinite",
        "scan-sweep": "scan-sweep 2.4s ease-in-out infinite",
        "flicker": "flicker 1.6s ease-in-out infinite",
        "flash-alert": "flash-alert 0.5s ease-in-out infinite",
        "gradient-shift": "gradient-shift 6s ease infinite",
        "float": "float 4s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};

export default config;
