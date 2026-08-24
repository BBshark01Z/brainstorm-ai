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
import { useLanguage } from "@/hooks/useLanguageContext";

/** Field descriptor for the "How to use" section of the About panel. */
interface AboutStep {
  titleKey: string;
  bodyKey: string;
  icon: LucideIcon;
}

const ABOUT_STEPS: AboutStep[] = [
  { titleKey: "dash.step1Title", bodyKey: "dash.step1Body", icon: Upload },
  { titleKey: "dash.step2Title", bodyKey: "dash.step2Body", icon: Fingerprint },
  { titleKey: "dash.step3Title", bodyKey: "dash.step3Body", icon: LineChartIcon },
  { titleKey: "dash.step4Title", bodyKey: "dash.step4Body", icon: Bot },
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
  const { t } = useLanguage();
  const [mode, setMode] = useState<InputMode>("websocket");
  const dataSource = useDataSource(mode);
  const { buffer, metrics, webSocket } = dataSource;
  const isConnected = webSocket.connectionState === "connected";

  // Stable values — computed once via useMemo so they don't jump on re-render
  const connectionStatus = useMemo(() => ({
    deviceName: t("dash.deviceName"),
    connected: isConnected,
    signalStrength: isConnected ? 97 : 0,
    batteryPercent: isConnected ? 88 : 0,
    impedanceQuality: isConnected ? ("good" as const) : ("poor" as const),
    channelImpedances: isConnected ? createChannelImpedances() : [],
  }), [isConnected, t]);

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
        <h1 className="text-lg font-display font-semibold text-ink">{t("dash.home")}</h1>
        <ShareReportButton
          reportType="dashboard"
          title={t("dash.shareTitle", { date: new Date().toLocaleDateString() })}
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
          <h2 className="font-display text-sm font-semibold text-ink">{t("dash.about")}</h2>
        </div>

        <p className="mt-3 text-sm leading-relaxed text-ink-muted">
          {t("dash.aboutBody")}
        </p>

        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {ABOUT_STEPS.map((step) => {
            const Icon = step.icon;
            return (
              <div
                key={step.titleKey}
                className="glass-pill flex gap-3 rounded-xl p-4"
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-cyan-500/10">
                  <Icon size={15} className="text-cyan-400" />
                </div>
                <div>
                  <p className="text-[13px] font-semibold text-ink">{t(step.titleKey)}</p>
                  <p className="mt-1 text-xs leading-relaxed text-ink-muted">{t(step.bodyKey)}</p>
                </div>
              </div>
            );
          })}
        </div>
      </GlowPanel>
    </div>
  );
}
