import { Battery, Signal, Radio, Activity, WifiOff } from "lucide-react";
import clsx from "clsx";
import { ConnectionStatus } from "@/lib/types";
import { useLanguage } from "@/hooks/useLanguageContext";

const IMPEDANCE_COLOR: Record<ConnectionStatus["impedanceQuality"], string> = {
  good: "#10B981",
  fair: "#F59E0B",
  poor: "#EF4444",
};

const IMPEDANCE_GLOW: Record<ConnectionStatus["impedanceQuality"], string> = {
  good: "0 0 6px rgba(16, 185, 129, 0.5)",
  fair: "0 0 6px rgba(245, 158, 11, 0.5)",
  poor: "0 0 6px rgba(239, 68, 68, 0.5)",
};

/** A single electrode dot with impedance indicator. */
function ElectrodeDot({ channel, kOhm, quality }: { channel: string; kOhm: number; quality: string }) {
  const color = IMPEDANCE_COLOR[quality as keyof typeof IMPEDANCE_COLOR] ?? "#64748B";
  const glow = IMPEDANCE_GLOW[quality as keyof typeof IMPEDANCE_GLOW] ?? "0 0 6px rgba(100, 116, 139, 0.5)";

  // Map kOhm to a visual bar height
  const barHeight = Math.max(4, Math.min(100, Math.max(0, 100 - kOhm * 10)));

  return (
    <div
      className="flex flex-col items-center gap-1 rounded-lg border border-slate-700/30 bg-slate-900/40 px-1.5 py-2"
      title={`${channel}: ${kOhm} kΩ`}
    >
      {/* Electrode dot */}
      <div className="relative flex h-8 w-8 items-center justify-center">
        <div
          className="h-2 w-2 rounded-full transition-all duration-300"
          style={{
            backgroundColor: color,
            boxShadow: glow,
          }}
        />
        {/* Outer ring */}
        <div
          className="absolute inset-0 rounded-full border"
          style={{
            borderColor: `${color}33`,
          }}
        />
      </div>
      <span className="text-[9px] font-mono text-slate-500">{channel}</span>
      {/* Impedance bar */}
      <div className="h-12 w-1.5 rounded-full bg-slate-800/50">
        <div
          className="w-full rounded-full transition-all duration-500"
          style={{
            height: `${barHeight}%`,
            backgroundColor: color,
            boxShadow: glow,
          }}
        />
      </div>
    </div>
  );
}

export function ConnectionStatusWidget({ connection }: { connection: ConnectionStatus }) {
  const { t } = useLanguage();
  const { connected, signalStrength, batteryPercent, impedanceQuality, channelImpedances, deviceName } = connection;
  const qualityColor = IMPEDANCE_COLOR[impedanceQuality];
  const qualityGlow = IMPEDANCE_GLOW[impedanceQuality];

  if (!connected) {
    return (
      <div
        className="flex flex-col gap-4 rounded-2xl border p-5 transition-all duration-300"
        style={{
          background: "linear-gradient(135deg, rgba(10, 15, 29, 0.9), rgba(14, 21, 37, 0.8))",
          borderColor: "rgba(100, 116, 139, 0.3)",
          boxShadow: "0 0 30px -8px rgba(100, 116, 139, 0.1)",
        }}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">{t("dash.headsetLink")}</h2>
          <WifiOff size={14} className="text-slate-600" />
        </div>
        <div className="flex flex-col items-center gap-3 py-4">
          <WifiOff size={28} className="text-slate-700" />
          <p className="text-xs font-medium text-slate-500">{t("dash.noConnection")}</p>
          <p className="text-[10px] text-slate-600">{t("dash.noConnectionHint")}</p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="flex flex-col gap-4 rounded-2xl border p-5 transition-all duration-300"
      style={{
        background: "linear-gradient(135deg, rgba(10, 15, 29, 0.9), rgba(14, 21, 37, 0.8))",
        borderColor: "rgba(30, 42, 61, 0.6)",
        boxShadow: "0 0 30px -8px rgba(6, 182, 212, 0.15)",
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">Headset Link</h2>
        <span className="text-[10px] font-mono text-slate-500">{deviceName}</span>
      </div>

      {/* Signal & Battery */}
      <div className="grid grid-cols-2 gap-3">
        <div className="flex items-center gap-2.5">
          <Signal size={16} className="text-cyan-400" />
          <div>
            <p className="text-sm font-bold text-white">{signalStrength}%</p>
            <p className="text-[10px] text-slate-500">{t("dash.signal")}</p>
          </div>
        </div>
        <div className="flex items-center gap-2.5">
          <Battery size={16} className="text-cyan-400" />
          <div>
            <p className="text-sm font-bold text-white">{batteryPercent}%</p>
            <p className="text-[10px] text-slate-500">{t("dash.battery")}</p>
          </div>
        </div>
      </div>

      {/* Impedance header */}
      <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
        <Radio size={12} />
        {t("dash.impedance")}
      </div>

      {/* Per-channel impedance dots */}
      <div className="grid grid-cols-3 gap-2">
        {channelImpedances.map((ch) => (
          <ElectrodeDot
            key={ch.channel}
            channel={ch.channel}
            kOhm={ch.kOhm}
            quality={impedanceQuality}
          />
        ))}
      </div>

      {/* Status bar */}
      <div
        className="flex items-center gap-2 rounded-lg px-3 py-2"
        style={{
          background: "rgba(16, 185, 129, 0.06)",
          border: "1px solid rgba(16, 185, 129, 0.15)",
        }}
      >
        <Activity size={12} className="text-emerald-400" />
        <span
          className="h-1.5 w-1.5 rounded-full"
          style={{
            backgroundColor: qualityColor,
            boxShadow: qualityGlow,
            animation: "pulse-ring 2s cubic-bezier(0.2, 0.6, 0.4, 1) infinite",
          }}
        />
        <span className="text-[10px] font-semibold text-emerald-400/80">
          {t("dash.channelsNominal", { count: channelImpedances.length })}
        </span>
      </div>
    </div>
  );
}
