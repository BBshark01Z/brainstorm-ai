"use client";

import { useState, useCallback } from "react";
import { Share2, Copy, Check, Loader2, AlertCircle } from "lucide-react";
import clsx from "clsx";
import { apiFetch, FetchErrorType } from "@/lib/fetchWithHealth";
import { getBackendHttpUrl } from "@/lib/getBackendUrl";

/**
 * ShareReportButton — A reusable button that creates a shareable report link.
 *
 * Usage:
 *   <ShareReportButton
 *     reportType="dashboard"
 *     title="EEG Session Report"
 *     metrics={...}
 *     onShare={async (url) => console.log("Shared:", url)}
 *   />
 */

interface ShareReportButtonProps {
  reportType: "dashboard" | "brainprint" | "analytics";
  title: string;
  metrics?: Record<string, unknown>;
  brainprintResult?: Record<string, unknown>;
  chatSummary?: string;
  notes?: string;
  onShare?: (url: string) => void;
  className?: string;
}

export function ShareReportButton({
  reportType,
  title,
  metrics,
  brainprintResult,
  chatSummary,
  notes,
  onShare,
  className,
}: ShareReportButtonProps) {
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shareUrl, setShareUrl] = useState<string | null>(null);

  const API_URL = getBackendHttpUrl();

  /** Copy text to clipboard with fallback. */
  const copyToClipboard = useCallback(async (text: string): Promise<boolean> => {
    if (navigator.clipboard && window.isSecureContext) {
      try {
        await navigator.clipboard.writeText(text);
        return true;
      } catch {
        // Fallback below
      }
    }
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
  }, []);

  const handleShare = useCallback(async () => {
    setLoading(true);
    setError(null);
    setCopied(false);
    setShareUrl(null);

    try {
      const result = await apiFetch("/api/share/report", {
        method: "POST",
        headers: { Authorization: "" }, // clear Content-Type override
        body: JSON.stringify({
          report_type: reportType,
          title,
          metrics: metrics || {},
          brainprint_result: brainprintResult,
          chat_summary: chatSummary,
          notes,
        }),
      });

      if (!result.ok) {
        const err = result.error;
        if (err.type === FetchErrorType.NETWORK) {
          throw new Error(`Backend unreachable: ${err.message}`);
        }
        throw new Error(err.detail || `Failed to create report (${err.status})`);
      }

      const data = result.data as { url: string; report_id: string };
      setShareUrl(data.url);
      setCopied(true);
      onShare?.(data.url);

      // Auto-copy to clipboard
      await copyToClipboard(data.url);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [API_URL, reportType, title, metrics, brainprintResult, chatSummary, notes, onShare, copyToClipboard]);

  const handleCopyUrl = useCallback(async () => {
    if (!shareUrl) return;
    const success = await copyToClipboard(shareUrl);
    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [shareUrl, copyToClipboard]);

  return (
    <div className={clsx("flex flex-col gap-2", className)}>
      <div className="flex items-center gap-2">
        {/* Share button */}
        <button
          onClick={handleShare}
          disabled={loading}
          className={clsx(
            "flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition-all",
            "border border-purple-500/30 text-purple-400 hover:bg-purple-500/10",
            loading && "opacity-50 cursor-wait"
          )}
          style={{ background: "rgba(168, 85, 247, 0.06)" }}
          title="Create shareable report link"
        >
          {loading ? (
            <>
              <Loader2 size={12} className="animate-spin" />
              Creating...
            </>
          ) : (
            <>
              <Share2 size={12} />
              Share Report
            </>
          )}
        </button>

        {/* Copy button (shown after share URL is generated) */}
        {shareUrl && !loading && (
          <button
            onClick={handleCopyUrl}
            className={clsx(
              "flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition-all",
              copied
                ? "border border-emerald-500/30 text-emerald-400 bg-emerald-500/10"
                : "border border-slate-700/30 text-slate-400 hover:bg-slate-500/10"
            )}
          >
            {copied ? (
              <>
                <Check size={12} />
                Copied!
              </>
            ) : (
              <>
                <Copy size={12} />
                Copy Link
              </>
            )}
          </button>
        )}
      </div>

      {/* Share URL display */}
      {shareUrl && !loading && (
        <div className="flex items-center gap-2 rounded-lg border border-slate-700/30 bg-slate-900/50 px-3 py-1.5">
          <code className="truncate text-[10px] font-mono text-slate-400">{shareUrl}</code>
        </div>
      )}

      {/* Error message */}
      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-red-500/20 bg-red-500/5 px-3 py-2">
          <AlertCircle size={12} className="flex-shrink-0 text-red-400" />
          <p className="text-[10px] text-red-400">{error}</p>
        </div>
      )}
    </div>
  );
}
