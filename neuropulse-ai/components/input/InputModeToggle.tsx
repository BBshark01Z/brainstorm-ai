"use client";

import clsx from "clsx";
import { Upload, Wifi } from "lucide-react";
import { InputMode } from "@/lib/types";
import { useLanguage } from "@/hooks/useLanguageContext";

const MODES: { value: InputMode; labelKey: string; icon: typeof Upload | typeof Wifi }[] = [
  { value: "file", labelKey: "dash.modeFile", icon: Upload },
  { value: "websocket", labelKey: "dash.modeWebSocket", icon: Wifi },
];

export function InputModeToggle({ value, onChange }: { value: InputMode; onChange: (mode: InputMode) => void }) {
  const { t } = useLanguage();
  return (
    <div className="inline-flex rounded-lg border border-slate-700/50 bg-slate-900/50 p-1">
      {MODES.map(({ value: mode, labelKey, icon: Icon }) => (
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
          {t(labelKey)}
        </button>
      ))}
    </div>
  );
}
