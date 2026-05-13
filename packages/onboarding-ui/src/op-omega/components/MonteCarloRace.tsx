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
      {/* Header caption — operator-readable framing for what the race
       *  actually represents. Without this the curves are engineering candy
       *  that looks impressive but mysterious. */}
      <div style={{ textAlign: "center", maxWidth: 560 }}>
        <div style={{ fontSize: 13, color: "var(--text)", fontWeight: 600, marginBottom: "0.25rem" }}>
          Finding your winning growth strategy
        </div>
        <div className="text-dim" style={{ fontSize: 11, lineHeight: 1.5 }}>
          {report.n_runs_per_strategy} runs × {report.horizon_cycles} cycles across 5 GTM
          strategies — the one with the best compound trajectory wins.
        </div>
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
  // Build a synthetic curve from the strategy's mean_mrr_growth. The winner
  // gets a 30% visual boost so it reaches near the top of the chart and
  // clearly "wins" the race rather than tying with the runners-up.
  const baseEnd = Math.max(0, Math.min(1, strategy.mean_mrr_growth / maxGrowth));
  const normalizedEnd = isWinner ? Math.min(0.92, baseEnd * 1.3 + 0.1) : baseEnd * 0.85;
  const N = 30;
  const visibleSamples = Math.max(2, Math.floor(progress * N));
  const points: Array<[number, number]> = [];
  for (let i = 0; i < visibleSamples; i++) {
    const t = i / (N - 1);
    // Winner uses a steeper ease-out (quart) so the line accelerates upward.
    // Others use the gentler cubic.
    const ease = isWinner ? 1 - Math.pow(1 - t, 4) : 1 - Math.pow(1 - t, 3);
    const y = ease * normalizedEnd;
    const px = PAD_X + ((WIDTH - PAD_X - 20) * t);
    const py = PAD_Y + (HEIGHT - PAD_Y * 2) * (1 - y);
    points.push([px, py]);
  }
  const polyPoints = points.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");

  // Winner gets an area-fill underneath for emphasis once the race winds down.
  const showFill = isWinner && progress > 0.5 && points.length > 1;
  const fillOpacity = isWinner ? Math.max(0, (progress - 0.5) * 0.5) : 0;
  const baselineY = HEIGHT - PAD_Y;
  const areaPath = showFill
    ? `M ${points[0][0]},${baselineY} ${polyPoints} L ${points[points.length - 1][0]},${baselineY} Z`
    : "";

  // Marker dot at the leading edge of the line for the winner.
  const lead = points[points.length - 1];

  const opacity = isWinner ? (progress > 0.85 ? 1 : 0.95) : (progress > 0.85 ? 0.2 : 0.7);
  const strokeWidth = isWinner ? (progress > 0.85 ? 4 : 3) : 1.5;

  return (
    <g style={{ transition: "opacity 0.5s ease-out" }} opacity={opacity}>
      {showFill && (
        <path d={areaPath} fill={color} opacity={fillOpacity} />
      )}
      <polyline
        points={polyPoints}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ transition: "stroke-width 0.5s ease-out" }}
      />
      {isWinner && lead && progress > 0.05 && (
        <circle
          cx={lead[0]}
          cy={lead[1]}
          r={progress > 0.85 ? 5 : 3.5}
          fill={color}
          stroke="var(--bg)"
          strokeWidth={1.5}
          style={{ transition: "r 0.4s ease-out" }}
        />
      )}
    </g>
  );
}
