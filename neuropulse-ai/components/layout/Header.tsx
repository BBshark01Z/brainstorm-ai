"use client";

import { Bluetooth, BluetoothOff, Fingerprint, ShieldCheck, Activity } from "lucide-react";
import { ConnectionStatus, BrainprintStatus } from "@/lib/types";
import { StatusPill } from "@/components/ui/primitives";
import clsx from "clsx";

export function Header({
  connection,
  brainprintStatus,
  wsLabel,
}: {
  connection: ConnectionStatus;
  brainprintStatus: BrainprintStatus;
  wsLabel?: string;
}) {
  const verified = brainprintStatus === "verified";
  const isStreaming = wsLabel === "Streaming";

  return (
    <header
      className="flex items-center justify-between border-b px-4 py-3 sm:px-6"
      style={{
        borderBottomColor: "rgba(30, 42, 61, 0.5)",
        background: "linear-gradient(90deg, rgba(10, 15, 29, 0.95), rgba(14, 21, 37, 0.9))",
      }}
    >
      <div>
        <h1 className="font-display text-base font-semibold text-white sm:text-lg">
          Real-time Brain Monitor
        </h1>
        <p className="text-xs text-slate-500">
          Session active · data refreshes every 150ms
          {wsLabel && (
            <span className="ml-2 inline-flex items-center gap-1.5">
              <span
                className={clsx(
                  "h-1.5 w-1.5 rounded-full",
                  isStreaming ? "bg-emerald-400 animate-pulse" : "bg-red-400"
                )}
                style={{
                  boxShadow: isStreaming ? "0 0 6px #10B981" : "0 0 6px #EF4444",
                }}
              />
              <span className={clsx("text-[10px] font-semibold uppercase tracking-wider", isStreaming ? "text-emerald-400" : "text-red-400")}>
                {wsLabel}
              </span>
            </span>
          )}
        </p>
      </div>

      <div className="flex items-center gap-2">
        <StatusPill
          icon={
            isStreaming ? (
              <Activity size={14} className="text-cyan-400" />
            ) : connection.connected ? (
              <Bluetooth size={14} className="text-cyan-400" />
            ) : (
              <BluetoothOff size={14} className="text-red-400" />
            )
          }
          label={
            isStreaming
              ? `EEG Stream · ${connection.deviceName}`
              : connection.connected
                ? `${connection.deviceName} · ${connection.signalStrength}%`
                : "No EEG Stream"
          }
          tone={isStreaming || connection.connected ? "vital" : "risk"}
        />
        <StatusPill
          icon={
            verified ? (
              <ShieldCheck size={14} className="text-violet-400" />
            ) : (
              <Fingerprint size={14} className="text-slate-500" />
            )
          }
          label={verified ? "Brainprint Verified" : "Not Verified"}
          tone={verified ? "neural" : "neutral"}
        />
      </div>
    </header>
  );
}
