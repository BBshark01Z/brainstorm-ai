"use client";

import clsx from "clsx";
import { Upload, Wifi } from "lucide-react";
import { InputMode } from "@/lib/types";

const MODES: { value: InputMode; label: string; icon: typeof Upload | typeof Wifi }[] = [
  { value: "file", label: "File Upload", icon: Upload },
  { value: "websocket", label: "WebSocket", icon: Wifi },
];

export function InputModeToggle({ value, onChange }: { value: InputMode; onChange: (mode: InputMode) => void }) {
  return (
    <div className="inline-flex rounded-lg border border-slate-700/50 bg-slate-900/50 p-1">
      {MODES.map(({ value: mode, label, icon: Icon }) => (
        <button
          key={mode}
          onClick={() => onChange(mode)}
          className={clsx(
            "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-all duration-200",
            value === mode
              ? "bg-cyan-500/15 text-cyan-400 shadow-sm"
              : "text-slate-500 hover:text-slate-300"
          )}
        >
          <Icon size={13} />
          {label}
        </button>
      ))}
    </div>
  );
}
