"use client";

import { useRef, useState } from "react";
import { UploadCloud, Play, Pause, FileWarning } from "lucide-react";
import { FileIngestionResult } from "@/lib/types";
import { useLanguage } from "@/hooks/useLanguageContext";

export function FileUploadPanel({
  result,
  isPlaying,
  onFile,
  onPasteText,
  onTogglePlay,
}: {
  result: FileIngestionResult | null;
  isPlaying: boolean;
  onFile: (file: File) => void;
  onPasteText: (text: string, format: "csv" | "json" | "raw") => void;
  onTogglePlay: () => void;
}) {
  const [isDragging, setIsDragging] = useState(false);
  const [pastedText, setPastedText] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const { t } = useLanguage();

  return (
    <div className="flex flex-col gap-3">
      {/* Drop zone */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragging(false);
          const file = e.dataTransfer.files?.[0];
          if (file) onFile(file);
        }}
        onClick={() => inputRef.current?.click()}
        className={`flex cursor-pointer flex-col items-center gap-2.5 rounded-xl border-2 border-dashed px-4 py-7 text-center transition-all duration-200 ${
          isDragging
            ? "border-vital bg-vital/5 scale-[1.01]"
            : "border-slate-700/50 hover:border-cyan-500/40 hover:bg-slate-800/20"
        }`}
      >
        <UploadCloud size={24} className="text-vital" />
        <p className="text-xs text-ink-muted">
          {t("dash.dropPrefix")} <span className="font-medium text-cyan-400/70">.csv</span>,{" "}
          <span className="font-medium text-cyan-400/70">.json</span>, {t("dash.dropMid")}{" "}
          <span className="font-medium text-cyan-400/70">.edf-like</span> {t("dash.dropSuffix")}
        </p>
        <input
          ref={inputRef}
          type="file"
          accept=".csv,.json,.edf,.txt"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) onFile(file);
          }}
        />
      </div>

      {/* Pasted text input */}
      <div className="flex flex-col gap-2">
        <label className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
          {t("dash.pasteLabel")}
        </label>
        <textarea
          value={pastedText}
          onChange={(e) => setPastedText(e.target.value)}
          placeholder={t("dash.pastePlaceholder")}
          rows={3}
          className="w-full rounded-lg border border-slate-700/50 bg-slate-900/50 px-3.5 py-2.5 font-mono text-xs text-white placeholder-slate-600 transition-all focus:border-cyan-500/50 focus:outline-none focus:ring-1 focus:ring-cyan-500/20"
        />
        <button
          onClick={() => pastedText.trim() && onPasteText(pastedText, "raw")}
          disabled={!pastedText.trim()}
          className="self-start rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-3.5 py-2 text-xs font-medium text-cyan-400 transition-all hover:bg-cyan-500/15 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {t("dash.playPasted")}
        </button>
      </div>

      {/* Result */}
      {result && (
        <div
          className="rounded-xl border border-slate-700/40 bg-slate-900/40 p-4 transition-all"
          style={{
            boxShadow: "0 0 20px -6px rgba(6, 182, 212, 0.08)",
          }}
        >
          <div className="mb-2 flex items-center justify-between">
            <p className="truncate text-xs font-medium text-white">{result.sourceName}</p>
            <button
              onClick={onTogglePlay}
              disabled={result.samples.length === 0}
              className="flex items-center gap-1.5 rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-3 py-1.5 text-[11px] font-medium text-cyan-400 transition-all hover:bg-cyan-500/15 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {isPlaying ? <Pause size={11} /> : <Play size={11} />}
              {isPlaying ? t("dash.pause") : t("dash.play")}
            </button>
          </div>
          <p className="text-[11px] text-slate-500">
            {t("dash.samplesCount", { count: result.samples.length, format: result.format.toUpperCase() })}
          </p>
          {result.warnings.length > 0 && (
            <div className="mt-2 flex flex-col gap-1.5">
              {result.warnings.map((w, i) => (
                <div key={i} className="flex items-start gap-1.5 text-[11px] text-risk-amber">
                  <FileWarning size={12} className="mt-0.5 flex-shrink-0" />
                  {w}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
