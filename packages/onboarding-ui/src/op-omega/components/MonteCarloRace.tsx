/** Monte Carlo race — animated 5-strategy line chart for the Imprint Theater
 *  Act 1.
 *
 *  The MC report ships summary stats per strategy (mean_mrr_growth, p_ruin,
 *  sharpe, mean_burn_multiple) but no per-cycle samples. We synthesize a
 *  representational curve per strategy by interpolating from a shared start
 *  to each strategy's mean_mrr_growth as the end-value, using an ease-out
 *  shape that looks like a compounding growth trajectory. The winner curve
 *  highlights with full opacity at the end of the animation. */

import { useEffect, useState } from "react";

/** Local shape of MonteCarloReport — plugin-onboarding's barrel doesn't
 *  re-export the type, so we narrow to the fields the chart consumes.
 *  Stays compatible with the wire shape returned by GET /op-omega/onboarding/mc-report. */
export interface StrategyRow {
  strategy_id: string;
  mean_mrr_growth: number;
  p_ruin: number;
  sharpe: number;
}

export interface MonteCarloReportLike {
  horizon_cycles: number;
  n_runs_per_strategy: number;
  strategies: StrategyRow[];
  winner: { strategy_id: string; rationale: string };
}

const STRATEGY_COLORS: Record<string, string> = {
  RETENTION_FIRST: "#86c5da",
  BALANCED: "#4ec9b0",
  ACQUISITION_HEAVY: "#f0b070",
  NARRATIVE_LED: "#c590e0",
  CAPITAL_EFFICIENT: "#9aa0a6",
};

const STRATEGY_LABELS: Record<string, string> = {
  RETENTION_FIRST: "Retention first",
  BALANCED: "Balanced",
  ACQUISITION_HEAVY: "Acquisition heavy",
  NARRATIVE_LED: "Narrative led",
  CAPITAL_EFFICIENT: "Capital efficient",
};

interface Props {
  report: MonteCarloReportLike;
  durationMs?: number;
  onComplete?: () => void;
}

const WIDTH = 720;
const HEIGHT = 280;
const PAD_X = 60;
const PAD_Y = 30;

export function MonteCarloRace({ report, durationMs = 6000, onComplete }: Props) {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const startedAt = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const elapsed = now - startedAt;
      const next = Math.min(1, elapsed / durationMs);
      setProgress(next);
      if (next < 1) raf = requestAnimationFrame(tick);
      else onComplete?.();
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [durationMs, onComplete]);

  // Normalize end-values across strategies into a 0..1 range for the chart's
  // y-axis. A strategy with mean_mrr_growth=0 sits at 0; the maximum sits
  // near 1 (with some headroom).
  const maxGrowth = Math.max(...report.strategies.map((s: StrategyRow) => Math.max(0, s.mean_mrr_growth)), 0.05);

  const winnerId = report.winner.strategy_id;

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "0.5rem" }}>
      <div className="text-dim" style={{ fontSize: 12 }}>
        Simulated {report.n_runs_per_strategy} runs × {report.horizon_cycles} cycles across 5 GTM strategies
      </div>
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} width="100%" style={{ maxWidth: WIDTH }}>
        {/* y-axis grid lines */}
        {[0, 0.25, 0.5, 0.75, 1].map((p) => (
          <line
            key={p}
            x1={PAD_X}
            x2={WIDTH - 20}
            y1={PAD_Y + (HEIGHT - PAD_Y * 2) * (1 - p)}
            y2={PAD_Y + (HEIGHT - PAD_Y * 2) * (1 - p)}
            stroke="var(--border)"
            strokeWidth={0.5}
            opacity={0.4}
          />
        ))}
        {/* x-axis label */}
        <text x={PAD_X} y={HEIGHT - 6} fontSize={10} fill="var(--text-dim)">cycle 0</text>
        <text x={WIDTH - 60} y={HEIGHT - 6} fontSize={10} fill="var(--text-dim)">cycle {report.horizon_cycles}</text>
        {/* strategy curves */}
        {report.strategies.map((s: StrategyRow) => (
          <StrategyLine
            key={s.strategy_id}
            strategy={s}
            progress={progress}
            maxGrowth={maxGrowth}
            isWinner={s.strategy_id === winnerId}
          />
        ))}
      </svg>
      <div style={{ display: "flex", gap: "0.85rem", flexWrap: "wrap", justifyContent: "center", marginTop: "0.25rem" }}>
        {report.strategies.map((s: StrategyRow) => (
          <div
            key={s.strategy_id}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.35rem",
              fontSize: 11,
              opacity: progress > 0.85 && s.strategy_id !== winnerId ? 0.35 : 1,
              transition: "opacity 0.6s ease-out",
            }}
          >
            <span style={{ width: 10, height: 2, background: STRATEGY_COLORS[s.strategy_id] ?? "#888", borderRadius: 2 }} />
            <span style={{ color: s.strategy_id === winnerId && progress > 0.85 ? "var(--accent)" : "var(--text-dim)", fontWeight: s.strategy_id === winnerId && progress > 0.85 ? 700 : 400 }}>
              {STRATEGY_LABELS[s.strategy_id] ?? s.strategy_id}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function StrategyLine({
  strategy, progress, maxGrowth, isWinner,
}: {
  strategy: StrategyRow;
  progress: number;
  maxGrowth: number;
  isWinner: boolean;
}) {
  const color = STRATEGY_COLORS[strategy.strategy_id] ?? "#888";
  // Build a synthetic curve: ease-out from 0 to normalizedEnd. We sample
  // ~30 points across the horizon.
  const normalizedEnd = Math.max(0, Math.min(1, strategy.mean_mrr_growth / maxGrowth));
  const N = 30;
  // Animation: at progress=p, draw the curve up to x = p * N samples.
  const visibleSamples = Math.max(2, Math.floor(progress * N));
  const points: string[] = [];
  for (let i = 0; i < visibleSamples; i++) {
    const t = i / (N - 1);
    // ease-out cubic — finishes near the end_value
    const ease = 1 - Math.pow(1 - t, 3);
    const y = ease * normalizedEnd;
    const px = PAD_X + ((WIDTH - PAD_X - 20) * t);
    const py = PAD_Y + (HEIGHT - PAD_Y * 2) * (1 - y);
    points.push(`${px.toFixed(1)},${py.toFixed(1)}`);
  }
  const opacity = isWinner && progress > 0.85 ? 1 : progress > 0.85 ? 0.25 : 0.85;
  const strokeWidth = isWinner && progress > 0.85 ? 3 : 1.6;

  return (
    <polyline
      points={points.join(" ")}
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      opacity={opacity}
      style={{ transition: "opacity 0.5s ease-out, stroke-width 0.5s ease-out" }}
    />
  );
}
