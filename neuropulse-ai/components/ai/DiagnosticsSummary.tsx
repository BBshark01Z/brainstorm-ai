import { Sparkles, BrainCircuit } from "lucide-react";
import { DiagnosticInsight } from "@/lib/types";
import { GlowPanel, SeverityBadge } from "@/components/ui/primitives";

export function DiagnosticsSummary({ insights }: { insights: DiagnosticInsight[] }) {
  return (
    <div className="rise-in" style={{ animationDelay: "40ms" }}>
    <GlowPanel glow="purple" className="h-full transition-shadow duration-300 hover:shadow-glow-purple">
      <div className="mb-4 flex items-center gap-2">
        <span className="glass-pill flex h-7 w-7 items-center justify-center rounded-lg">
          <Sparkles size={15} className="text-neural" />
        </span>
        <h2 className="font-display text-sm font-semibold text-ink">Automated Daily AI Diagnostics</h2>
      </div>

      {insights.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-base-border py-10 text-center">
          <BrainCircuit size={28} className="text-neural/40" />
          <p className="text-sm font-medium text-ink-muted">No diagnostics yet</p>
          <p className="max-w-xs text-xs leading-relaxed text-ink-faint">
            Connect a live EEG stream and complete a Brainprint scan to generate
            automated daily insights here.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {insights.map((insight) => (
            <div
              key={insight.id}
              className="rounded-lg border border-base-border bg-base-overlay/40 p-3 transition-colors hover:bg-base-overlay/60"
            >
              <div className="mb-1.5 flex items-start justify-between gap-2">
                <p className="text-sm font-medium text-ink">{insight.title}</p>
                <SeverityBadge severity={insight.severity} />
              </div>
              <p className="text-xs leading-relaxed text-ink-muted">{insight.description}</p>
              <p className="mt-1.5 text-[11px] text-ink-faint">
                {new Date(insight.timestamp).toLocaleString()}
              </p>
            </div>
          ))}
        </div>
      )}
    </GlowPanel>
    </div>
  );
}
