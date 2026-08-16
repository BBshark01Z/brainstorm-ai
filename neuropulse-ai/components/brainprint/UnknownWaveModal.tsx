"use client";

import { useState } from "react";
import { LineChart, Line, ResponsiveContainer } from "recharts";
import { AlertTriangle, X, Save } from "lucide-react";

export function UnknownWaveModal({
  capturedVector,
  similarityScore,
  onSave,
  onDismiss,
}: {
  capturedVector: number[];
  similarityScore: number;
  onSave: (nickname: string) => void;
  onDismiss: () => void;
}) {
  const [nickname, setNickname] = useState("");
  const chartData = capturedVector.map((v, i) => ({ index: i, value: v }));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="panel w-full max-w-md border-risk-orange/40 p-6 shadow-glow-amber">
        <div className="mb-4 flex items-start justify-between">
          <div className="flex items-center gap-2 text-risk-orange">
            <AlertTriangle size={18} className="animate-flicker" />
            <h2 className="font-display text-sm font-semibold">New / Unknown Brainwave Signature</h2>
          </div>
          <button onClick={onDismiss} className="text-ink-faint hover:text-ink">
            <X size={16} />
          </button>
        </div>

        <p className="mb-3 text-xs text-ink-muted">
          This capture didn't match any enrolled profile (best match: {similarityScore.toFixed(1)}%, below the
          verification threshold). Give this pattern a nickname to add it to the Brainprint database.
        </p>

        <div className="mb-4 h-20 w-full rounded-lg border border-base-border bg-base-overlay/40 p-2">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <Line type="monotone" dataKey="value" stroke="#FF6A3D" strokeWidth={1.5} dot={false} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <label className="mb-4 block text-xs text-ink-muted">
          Set Nickname for this Pattern / Person
          <input
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            placeholder='e.g. "Mom - Meditating", "User B"'
            className="mt-1 w-full rounded-lg border border-base-border bg-base-overlay/50 px-3 py-2 text-sm text-ink placeholder:text-ink-faint focus:border-neural/50"
          />
        </label>

        <div className="flex justify-end gap-2">
          <button onClick={onDismiss} className="rounded-lg px-4 py-2 text-sm text-ink-muted hover:text-ink">
            Dismiss
          </button>
          <button
            onClick={() => nickname.trim() && onSave(nickname.trim())}
            disabled={!nickname.trim()}
            className="flex items-center gap-2 rounded-lg bg-neural px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
          >
            <Save size={14} />
            Save &amp; Train into Brainprint Database
          </button>
        </div>
      </div>
    </div>
  );
}
