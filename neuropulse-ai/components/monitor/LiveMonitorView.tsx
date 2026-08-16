"use client";

import { useState, useMemo } from "react";
import {
  Info,
  Upload,
  Fingerprint,
  LineChart as LineChartIcon,
  Bot,
  type LucideIcon,
} from "lucide-react";
import { InputMode } from "@/lib/types";
import { useDataSource } from "@/hooks/useDataSource";
import { DataInputPanel } from "@/components/input/DataInputPanel";
import { EEGWaveformChart } from "./EEGWaveformChart";
import { ConnectionStatusWidget } from "./ConnectionStatusWidget";
import { ShareReportButton } from "@/components/share/ShareReportButton";
import { GlowPanel } from "@/components/ui/primitives";

/** Field descriptor for the "How to use" section of the About panel. */
interface AboutStep {
  title: string;
  body: string;
  icon: LucideIcon;
}

const ABOUT_STEPS: AboutStep[] = [
  {
    title: "Live EEG or uploaded data",
    body: "Connect to a WebSocket stream to see computed band powers live, or upload / paste an EEG file (CSV, JSON, or raw samples) to replay it on the waveform chart.",
    icon: Upload,
  },
  {
    title: "Brainprint identity",
    body: "Capture an EEG reading to build a personal \"brainprint\" — a biometric signature — then verify against it on later sessions.",
    icon: Fingerprint,
  },
  {
    title: "Longitudinal analytics",
    body: "Review how key markers (burnout risk, FAA, sleep spindle density, slow-wave sleep) trend over time and compare against your recent 30-day baseline.",
    icon: LineChartIcon,
  },
  {
    title: "AI neuro-consultant",
    body: "Ask an AI assistant to interpret your EEG context and surface what's worth watching — with a local rule-based fallback whenever the model endpoint is unreachable.",
    icon: Bot,
  },
];

/** Generate stable simulated channel impedances. */
function createChannelImpedances() {
  const channels = ["F3", "F4", "C3", "C4", "P3", "P4"];
  return channels.map((ch) => ({
    channel: ch,
    kOhm: Math.round((1.5 + Math.random() * 2) * 10) / 10,
  }));
}

export function LiveMonitorView() {
  const [mode, setMode] = useState<InputMode>("websocket");
  const dataSource = useDataSource(mode);
  const { buffer, metrics, webSocket } = dataSource;
  const isConnected = webSocket.connectionState === "connected";

  // Stable values — computed once via useMemo so they don't jump on re-render
  const connectionStatus = useMemo(() => ({
    deviceName: "EEG Stream",
    connected: isConnected,
    signalStrength: isConnected ? 97 : 0,
    batteryPercent: isConnected ? 88 : 0,
    impedanceQuality: isConnected ? ("good" as const) : ("poor" as const),
    channelImpedances: isConnected ? createChannelImpedances() : [],
  }), [isConnected]);

  // Build metrics snapshot for sharing
  const shareMetrics = useMemo(() => ({
    focusScore: metrics.focusScore,
    stressLevel: metrics.stressLevel,
    mentalFatigue: metrics.mentalFatigue,
    faaIndex: metrics.faaIndex,
    latestSample: buffer.length > 0 ? buffer[buffer.length - 1] : null,
    sampleCount: buffer.length,
    connected: isConnected,
    capturedAt: new Date().toISOString(),
  }), [metrics, buffer, isConnected]);

  return (
    <div className="flex flex-col gap-4">
      {/* Header with share button */}
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-display font-semibold text-ink">Home</h1>
        <ShareReportButton
          reportType="dashboard"
          title={`EEG Monitor — ${new Date().toLocaleDateString()}`}
          metrics={shareMetrics}
          className="!m-0"
        />
      </div>

      <DataInputPanel mode={mode} onModeChange={setMode} dataSource={dataSource} />

      {/* Waveform chart + headset link: hidden in websocket mode so "About this
          project" reflows up to fill the gap (conditional render, not CSS hide). */}
      {mode !== "websocket" && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
          <EEGWaveformChart data={buffer} />
          <div className="lg:col-span-1">
            <ConnectionStatusWidget connection={connectionStatus} />
          </div>
        </div>
      )}

      {/* About this project */}
      <GlowPanel className="mt-2">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-cyan-500/10">
            <Info size={14} className="text-cyan-400" />
          </span>
          <h2 className="font-display text-sm font-semibold text-ink">About this project</h2>
        </div>

        <p className="mt-3 text-sm leading-relaxed text-ink-muted">
          Brainstorm is an experimental NeuroTech platform exploring what an end-to-end EEG
          monitoring + analytics pipeline looks like. By default everything runs on simulated
          data — a synthetic signal generator or uploaded files stand in for a real EEG device,
          and the AI consultant falls back to local rule-based responses when the model endpoint
          is unavailable. It's a learning project built to prototype the real signal-processing
          path, biometric identity, longitudinal analysis, and an AI interpretation layer — not a
          validated clinical tool.
        </p>

        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {ABOUT_STEPS.map((step) => {
            const Icon = step.icon;
            return (
              <div
                key={step.title}
                className="glass-pill flex gap-3 rounded-xl p-4"
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-cyan-500/10">
                  <Icon size={15} className="text-cyan-400" />
                </div>
                <div>
                  <p className="text-[13px] font-semibold text-ink">{step.title}</p>
                  <p className="mt-1 text-xs leading-relaxed text-ink-muted">{step.body}</p>
                </div>
              </div>
            );
          })}
        </div>
      </GlowPanel>
    </div>
  );
}
