import clsx from "clsx";
import { Wifi, WifiOff, Loader2, AlertCircle, Zap, Clock, Share2, Copy, Check } from "lucide-react";
import { useState, useCallback } from "react";
import { WebSocketConnectionState } from "@/lib/types";
import { getBackendHttpUrl } from "@/lib/getBackendUrl";
import { useLanguage } from "@/hooks/useLanguageContext";

const STATE_CONFIG: Record<WebSocketConnectionState, {
  labelKey: string;
  sublabelKey: string;
  tone: string;
  dotColor: string;
  dotGlow: string;
  borderColor: string;
  bgTint: string;
}> = {
  disconnected: {
    labelKey: "dash.ws.disconnected",
    sublabelKey: "dash.ws.disconnectedSub",
    tone: "text-slate-500",
    dotColor: "#64748B",
    dotGlow: "0 0 4px rgba(100, 116, 139, 0.4)",
    borderColor: "rgba(100, 116, 139, 0.2)",
    bgTint: "rgba(100, 116, 139, 0.03)",
  },
  connecting: {
    labelKey: "dash.ws.connecting",
    sublabelKey: "dash.ws.connectingSub",
    tone: "text-amber-400",
    dotColor: "#F59E0B",
    dotGlow: "0 0 6px rgba(245, 158, 11, 0.5)",
    borderColor: "rgba(245, 158, 11, 0.25)",
    bgTint: "rgba(245, 158, 11, 0.04)",
  },
  connected: {
    labelKey: "dash.ws.connected",
    sublabelKey: "dash.ws.connectedSub",
    tone: "text-emerald-400",
    dotColor: "#10B981",
    dotGlow: "0 0 8px rgba(16, 185, 129, 0.6)",
    borderColor: "rgba(16, 185, 129, 0.25)",
    bgTint: "rgba(16, 185, 129, 0.04)",
  },
  error: {
    labelKey: "dash.ws.error",
    sublabelKey: "dash.ws.errorSub",
    tone: "text-red-400",
    dotColor: "#EF4444",
    dotGlow: "0 0 6px rgba(239, 68, 68, 0.5)",
    borderColor: "rgba(239, 68, 68, 0.25)",
    bgTint: "rgba(239, 68, 68, 0.04)",
  },
};

/**
 * Copy text to clipboard with fallback for older browsers.
 * Returns true if successful.
 */
async function copyToClipboard(text: string): Promise<boolean> {
  if (navigator.clipboard && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Fallback below
    }
  }
  // Fallback for non-HTTPS or older browsers
  const textArea = document.createElement("textarea");
  textArea.value = text;
  textArea.style.position = "fixed";
  textArea.style.left = "-999999px";
  document.body.appendChild(textArea);
  textArea.select();
  try {
    document.execCommand("copy");
    return true;
  } catch {
    return false;
  } finally {
    document.body.removeChild(textArea);
  }
}

export function WebSocketPanel({
  url,
  onUrlChange,
  connectionState,
  lastError,
  onConnect,
  onDisconnect,
}: {
  url: string;
  onUrlChange: (url: string) => void;
  connectionState: WebSocketConnectionState;
  lastError: string | null;
  onConnect: () => void;
  onDisconnect: () => void;
}) {
  const { t } = useLanguage();
  const config = STATE_CONFIG[connectionState];
  const isConnected = connectionState === "connected";
  const isConnecting = connectionState === "connecting";
  const [copied, setCopied] = useState(false);

  const handleCopyLink = useCallback(async () => {
    // Generate shareable URL based on current API URL
    const apiUrl = getBackendHttpUrl();
    const shareUrl = apiUrl.replace(/^http/, "http"); // Keep HTTP for local network sharing
    const success = await copyToClipboard(shareUrl);
    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, []);

  return (
    <div
      className="flex flex-col gap-4 rounded-2xl border p-5 transition-all duration-300"
      style={{
        background: "linear-gradient(135deg, rgba(10, 15, 29, 0.9), rgba(14, 21, 37, 0.8))",
        borderColor: config.borderColor,
        boxShadow: isConnecting
          ? `0 0 30px -8px rgba(245, 158, 11, 0.1)`
          : isConnected
            ? `0 0 30px -8px rgba(16, 185, 129, 0.1)`
            : "0 0 30px -8px rgba(6, 182, 212, 0.08)",
      }}
    >
      {/* Header with status */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className={clsx("flex items-center gap-2 text-xs font-semibold", config.tone)}>
            {isConnecting ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <span
                className="h-2 w-2 rounded-full transition-all duration-300"
                style={{
                  backgroundColor: config.dotColor,
                  boxShadow: config.dotGlow,
                  animation: isConnected ? "pulse-ring 2s cubic-bezier(0.2, 0.6, 0.4, 1) infinite" : "none",
                }}
              />
            )}
            {t(config.labelKey)}
          </div>
          <span className="text-[10px] text-slate-600">{t(config.sublabelKey)}</span>
        </div>
        <div className="flex items-center gap-2">
          {/* Share button */}
          <button
            onClick={handleCopyLink}
            disabled={!isConnected}
            className={clsx(
              "flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition-all",
              isConnected
                ? "border border-purple-500/30 text-purple-400 hover:bg-purple-500/10"
                : "border border-slate-700/30 text-slate-600 opacity-50 cursor-not-allowed"
            )}
            style={{
              background: isConnected ? "rgba(168, 85, 247, 0.06)" : "transparent",
            }}
            title={t("dash.copyShareLink")}
          >
            {copied ? (
              <>
                <Check size={12} />
                {t("dash.copied")}
              </>
            ) : (
              <>
                <Share2 size={12} />
                {t("dash.share")}
              </>
            )}
          </button>

          {/* Connect/Disconnect button */}
          <button
            onClick={isConnected ? onDisconnect : onConnect}
            disabled={isConnecting}
            className={clsx(
              "flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-semibold transition-all",
              isConnected
                ? "border border-red-500/30 text-red-400 hover:bg-red-500/10"
                : "border border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/10",
              isConnecting && "opacity-40 cursor-not-allowed"
            )}
            style={{
              background: isConnected ? "rgba(239, 68, 68, 0.06)" : "rgba(6, 182, 212, 0.06)",
            }}
          >
            {isConnected ? (
              <>
                <WifiOff size={12} />
                {t("dash.disconnect")}
              </>
            ) : (
              <>
                <Zap size={12} />
                {t("dash.connect")}
              </>
            )}
          </button>
        </div>
      </div>

      {/* URL Input */}
      <div>
        <label className="mb-1.5 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
          <Wifi size={10} />
          {t("dash.wsEndpoint")}
        </label>
        <input
          value={url}
          onChange={(e) => onUrlChange(e.target.value)}
          disabled={isConnecting || isConnected}
          placeholder="ws://localhost:8765/ws/eeg-stream"
          className={clsx(
            "w-full rounded-lg border px-3.5 py-2.5 font-mono text-xs text-white placeholder-slate-600 transition-all focus:outline-none",
            (isConnecting || isConnected)
              ? "border-slate-700/30 bg-slate-900/30 opacity-60"
              : "border-slate-700/50 bg-slate-900/50 focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/20"
          )}
        />
      </div>

      {/* Connection info bar */}
      <div
        className="flex items-center gap-3 rounded-lg px-3.5 py-2"
        style={{
          background: config.bgTint,
          border: `1px solid ${config.borderColor}`,
        }}
      >
        {isConnected ? (
          <>
            <div className="flex items-center gap-1.5 text-[10px] text-slate-500">
              <Zap size={10} className="text-emerald-400" />
              <span className="text-emerald-400/80">{t("dash.live")}</span>
            </div>
            <div className="h-3 w-px bg-slate-700/50" />
            <div className="flex items-center gap-1.5 text-[10px] text-slate-500">
              <Clock size={10} />
              <span>{t("dash.intervals")}</span>
            </div>
            <div className="h-3 w-px bg-slate-700/50" />
            <div className="flex items-center gap-1.5 text-[10px] text-slate-500">
              <span className="text-cyan-400/80">{t("dash.heartbeat")}</span>
              <span className="text-emerald-400/60">{t("dash.on")}</span>
            </div>
          </>
        ) : (
          <div className="flex items-center gap-1.5 text-[10px] text-slate-600">
            <Clock size={10} />
            <span>{t("dash.autoReconnect")}</span>
          </div>
        )}
      </div>

      {/* Error */}
      {lastError && (
        <div
          className="flex items-start gap-2 rounded-lg border px-3.5 py-2.5"
          style={{
            borderColor: "rgba(239, 68, 68, 0.2)",
            background: "rgba(239, 68, 68, 0.06)",
          }}
        >
          <AlertCircle size={13} className="mt-0.5 flex-shrink-0 text-red-400" />
          <p className="text-[11px] text-red-400">{lastError}</p>
        </div>
      )}

      {/* Info */}
      <div
        className="flex items-start gap-2 rounded-lg px-3 py-2"
        style={{ background: "rgba(15, 23, 42, 0.4)" }}
      >
        <span className="mt-0.5 text-[10px] text-cyan-400/60">i</span>
        <p className="text-[10px] leading-relaxed text-slate-500">
          {t("dash.wsInfoPrefix")}{" "}
          <code className="font-mono text-cyan-400/60">{"{ delta, theta, alpha, beta, gamma }"}</code>{" "}
          {t("dash.wsInfoSuffix")}
        </p>
      </div>
    </div>
  );
}
