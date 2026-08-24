"use client";

import Link from "next/link";
import { ShieldCheck, LineChart, RotateCcw } from "lucide-react";
import { KnownBrainprintProfile } from "@/lib/types";
import { GlowPanel } from "@/components/ui/primitives";
import { useLanguage } from "@/hooks/useLanguageContext";

export function ProfileVerifiedPanel({
  profile,
  similarityScore,
  noveltyScore,
  verifiedAt,
  onScanAgain,
}: {
  profile: KnownBrainprintProfile;
  /**
   * Real match score (0–100) from the backend verify response (cosine
   * similarity). Not a mock — computed server-side from the scan vector.
   */
  similarityScore: number;
  /**
   * Real Mahalanobis out-of-distribution ("novelty") distance from the
   * backend verify response. Null when too few profiles are enrolled for it
   * to be computed. In the original code this real value was discarded.
   */
  noveltyScore: number | null;
  /** ISO timestamp of when this verification scan completed. */
  verifiedAt: string | null;
  /** Starts a fresh verification scan from this panel — no page refresh. */
  onScanAgain: () => void;
}) {
  // Carry the profile + timestamp to Analytics as best-effort context. The
  // Analytics view computes its own longitudinal trends and does not ingest
  // the brainprint scan vector, so there is no specific data point to deep
  // link / auto-scroll to — a plain link is used and the params are harmless
  // context for any future highlighting.
  const { t } = useLanguage();
  const analyticsHref = verifiedAt
    ? `/analytics?profile=${encodeURIComponent(profile.nickname)}&at=${encodeURIComponent(verifiedAt)}`
    : "/analytics";

  return (
    <GlowPanel glow="cyan" className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 text-neon">
            <ShieldCheck size={16} />
            <span className="text-xs font-semibold">{t("bp.verified")}</span>
          </div>
          <h2 className="mt-1 font-display text-lg font-semibold text-ink">{profile.nickname}</h2>
        </div>
        <div className="text-right">
          <p className="font-display text-2xl font-semibold text-neon">{similarityScore.toFixed(1)}%</p>
          <p className="text-[11px] text-ink-faint">{t("bp.matchScore")}</p>
        </div>
      </div>

      {/* Real, computed values from the verify response — no fabricated
          metric breakdowns. The radar chart that previously plotted
          hardcoded Focus/Calm/Sleep-Quality values has been removed. */}
      <div className="flex flex-wrap gap-3 text-[11px]">
        <div className="rounded-md border border-base-border bg-base-overlay/50 px-2.5 py-1.5">
          <p className="text-ink-faint">{t("bp.matchScore")}</p>
          <p className="font-mono text-sm font-medium text-neon">{similarityScore.toFixed(1)}%</p>
        </div>
        <div className="rounded-md border border-base-border bg-base-overlay/50 px-2.5 py-1.5">
          <p className="text-ink-faint">{t("bp.novelty")}</p>
          {noveltyScore != null ? (
            <p className="font-mono text-sm font-medium text-ink">{noveltyScore.toFixed(3)}</p>
          ) : (
            <p className="text-xs text-ink-faint">—</p>
          )}
        </div>
      </div>

      <div className="flex justify-between text-[11px] text-ink-faint">
        <span>{t("bp.enrolledOn", { date: profile.enrolledAt ? new Date(profile.enrolledAt).toLocaleDateString() : "—" })}</span>
        <span>{t("bp.sessions", { count: profile.sessionsCount })}</span>
      </div>

      {/* Next actions — the user can immediately re-scan without a page
          refresh, or view the full session in Analytics. */}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onScanAgain}
          className="inline-flex items-center gap-1.5 rounded-md bg-neural/15 px-3 py-1.5 text-xs font-medium text-neural transition-colors hover:bg-neural/25"
        >
          <RotateCcw size={13} />
          {t("bp.scanAgain")}
        </button>
        {/* Link to Analytics carrying profile + session timestamp context. */}
        <Link
          href={analyticsHref}
          className="inline-flex items-center gap-1.5 rounded-md border border-base-border bg-base-overlay/50 px-3 py-1.5 text-xs font-medium text-ink transition-colors hover:border-neural/40 hover:text-neural"
        >
          <LineChart size={13} />
          {t("bp.viewAnalytics")}
        </Link>
      </div>
    </GlowPanel>
  );
}