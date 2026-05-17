#!/usr/bin/env node
/**
 * Generates docs/ops/surface-tuning-chart.html — a self-contained, print-
 * friendly scatter of the 40 tunables on the (diversity × accuracy) plane.
 * Open in any browser. No external dependencies.
 *
 * Run: pnpm omega:tune:chart
 */

import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { TUNABLES, type SurfaceAxis, type Coupling, type Tunable } from "./registry.js";

const AXIS_COLORS: Record<SurfaceAxis, string> = {
  active_agent_set: "#c11b2a",
  overlay_tokens: "#b67fff",
  workflow_tasks: "#4a9eff",
  bundle_allocation_l1: "#f0b954",
  connector_set: "#52c896",
  dry_run_gates: "#7a8899",
  mc_winner: "#ff6b7a",
  mc_projection_l2: "#ff9a4a",
};

const AXIS_LABELS: Record<SurfaceAxis, string> = {
  active_agent_set: "Active agent set",
  overlay_tokens: "Overlay tokens",
  workflow_tasks: "Workflow tasks",
  bundle_allocation_l1: "Bundle allocation (L1)",
  connector_set: "Connector set",
  dry_run_gates: "Dry-run gates",
  mc_winner: "MC winner",
  mc_projection_l2: "MC projection (L2)",
};

const COUPLING_RADIUS: Record<Coupling, number> = {
  runtime: 7,
  prompt: 9,
  structural: 11,
};

// SVG layout.
const W = 900;
const H = 820;
const M_LEFT = 110;
const M_RIGHT = 50;
const M_TOP = 70;
const M_BOTTOM = 70;
const PLOT_W = W - M_LEFT - M_RIGHT;
const PLOT_H = H - M_TOP - M_BOTTOM;

// -2..+2 maps across the plot.
function x(div: number): number {
  return M_LEFT + ((div + 2) / 4) * PLOT_W;
}
function y(acc: number): number {
  // inverted: +2 at top
  return M_TOP + ((2 - acc) / 4) * PLOT_H;
}

function jitterOffsets(count: number, radius = 18): Array<[number, number]> {
  if (count <= 1) return [[0, 0]];
  const out: Array<[number, number]> = [];
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2;
    out.push([Math.cos(a) * radius, Math.sin(a) * radius]);
  }
  return out;
}

function escape(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function render(): string {
  // Bucket by (div, acc) to compute jitter.
  const buckets = new Map<string, Tunable[]>();
  for (const t of TUNABLES) {
    const key = `${t.diversityPull},${t.accuracyPull}`;
    const arr = buckets.get(key) ?? [];
    arr.push(t);
    buckets.set(key, arr);
  }

  const dots: string[] = [];
  for (const [, group] of buckets) {
    const offsets = jitterOffsets(group.length);
    group.forEach((t, i) => {
      const [dx, dy] = offsets[i];
      const cx = x(t.diversityPull) + dx;
      const cy = y(t.accuracyPull) + dy;
      const r = COUPLING_RADIUS[t.coupling];
      const fill = AXIS_COLORS[t.axis];
      const dataAttrs = [
        `data-id="${escape(t.id)}"`,
        `data-axis="${escape(AXIS_LABELS[t.axis])}"`,
        `data-phase="${escape(t.phase)}"`,
        `data-coupling="${t.coupling}"`,
        `data-div="${t.diversityPull}"`,
        `data-acc="${t.accuracyPull}"`,
        `data-desc="${escape(t.description)}"`,
        `data-current="${escape(t.currentValue)}"`,
        `data-loc="${escape(t.location)}"`,
        `data-safe="${escape(t.safeRange ?? "")}"`,
        `data-risk="${escape(t.risk ?? "")}"`,
      ].join(" ");
      dots.push(
        `<circle class="dot" cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="${r}" fill="${fill}" ${dataAttrs}><title>${escape(t.id)} — ${escape(t.description)}</title></circle>`,
      );
    });
  }

  // Grid lines at integer steps.
  const gridLines: string[] = [];
  for (let i = -2; i <= 2; i++) {
    gridLines.push(
      `<line x1="${x(i)}" y1="${M_TOP}" x2="${x(i)}" y2="${M_TOP + PLOT_H}" class="${i === 0 ? "axis" : "grid"}" />`,
    );
    gridLines.push(
      `<line x1="${M_LEFT}" y1="${y(i)}" x2="${M_LEFT + PLOT_W}" y2="${y(i)}" class="${i === 0 ? "axis" : "grid"}" />`,
    );
  }

  // Tick labels.
  const ticks: string[] = [];
  for (let i = -2; i <= 2; i++) {
    const label = i > 0 ? `+${i}` : `${i}`;
    ticks.push(
      `<text class="tick" x="${x(i)}" y="${M_TOP + PLOT_H + 22}" text-anchor="middle">${label}</text>`,
    );
    ticks.push(
      `<text class="tick" x="${M_LEFT - 14}" y="${y(i) + 4}" text-anchor="end">${label}</text>`,
    );
  }

  // Quadrant labels (centered in each quadrant, subtle).
  const qx = (M_LEFT + M_LEFT + PLOT_W) / 2;
  const qy = (M_TOP + M_TOP + PLOT_H) / 2;
  const quadrants = `
    <text class="quad" x="${(M_LEFT + qx) / 2}" y="${(M_TOP + qy) / 2}">accuracy dial</text>
    <text class="quad" x="${(qx + M_LEFT + PLOT_W) / 2}" y="${(M_TOP + qy) / 2}">free lunch</text>
    <text class="quad" x="${(M_LEFT + qx) / 2}" y="${(qy + M_TOP + PLOT_H) / 2}">dead weight</text>
    <text class="quad" x="${(qx + M_LEFT + PLOT_W) / 2}" y="${(qy + M_TOP + PLOT_H) / 2}">diversity dial</text>
  `;

  // Legend: axes.
  const axisLegendItems = (Object.keys(AXIS_COLORS) as SurfaceAxis[])
    .map((a) => {
      const count = TUNABLES.filter((t) => t.axis === a).length;
      return `<div class="lg-row"><span class="lg-dot" style="background:${AXIS_COLORS[a]}"></span>${AXIS_LABELS[a]} <span class="lg-count">${count}</span></div>`;
    })
    .join("");

  // Legend: coupling.
  const couplingLegend = (["runtime", "prompt", "structural"] as Coupling[])
    .map((c) => {
      const count = TUNABLES.filter((t) => t.coupling === c).length;
      const r = COUPLING_RADIUS[c];
      return `<div class="lg-row"><svg class="lg-svg" width="24" height="24" viewBox="0 0 24 24"><circle cx="12" cy="12" r="${r}" fill="#bbb" /></svg>${c} <span class="lg-count">${count}</span></div>`;
    })
    .join("");

  const totalCount = TUNABLES.length;

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>Operator Ω · Surface Tuning Map</title>
<style>
  * { box-sizing: border-box; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    background: #0d0f12;
    color: #e6e6e6;
    margin: 0;
    padding: 32px;
  }
  h1 { font-weight: 600; margin: 0 0 4px; letter-spacing: -0.02em; }
  .sub { color: #8a8f98; font-size: 13px; margin-bottom: 24px; }
  .wrap { display: grid; grid-template-columns: 1fr 320px; gap: 24px; max-width: 1320px; margin: 0 auto; }
  .chart { background: #13171c; border: 1px solid #232830; border-radius: 12px; padding: 12px; }
  svg.plot { width: 100%; height: auto; display: block; }
  .grid { stroke: #1f242c; stroke-width: 1; stroke-dasharray: 2 4; }
  .axis { stroke: #3a4150; stroke-width: 1; }
  .tick { fill: #8a8f98; font-size: 11px; font-family: ui-monospace, "SF Mono", Menlo, monospace; }
  .axis-label { fill: #c8cdd4; font-size: 13px; font-weight: 500; }
  .quad { fill: #4a5160; font-size: 11px; text-anchor: middle; font-style: italic; letter-spacing: 0.08em; text-transform: uppercase; }
  .dot { cursor: pointer; stroke: rgba(255,255,255,0.08); stroke-width: 1; transition: transform 120ms, filter 120ms; transform-origin: center; transform-box: fill-box; }
  .dot:hover { stroke: #fff; stroke-width: 2; filter: brightness(1.25) drop-shadow(0 0 6px currentColor); }
  .dot.selected { stroke: #fff; stroke-width: 3; filter: brightness(1.3) drop-shadow(0 0 10px currentColor); }
  .side { display: flex; flex-direction: column; gap: 16px; }
  .card { background: #13171c; border: 1px solid #232830; border-radius: 12px; padding: 16px; }
  .card h3 { margin: 0 0 10px; font-size: 12px; text-transform: uppercase; letter-spacing: 0.1em; color: #8a8f98; font-weight: 600; }
  .lg-row { display: flex; align-items: center; gap: 8px; font-size: 13px; padding: 3px 0; }
  .lg-dot { width: 14px; height: 14px; border-radius: 50%; display: inline-block; }
  .lg-svg { flex-shrink: 0; }
  .lg-count { margin-left: auto; color: #8a8f98; font-variant-numeric: tabular-nums; }
  #details { font-size: 13px; line-height: 1.55; }
  #details.empty { color: #6a7080; }
  .det-id { font-family: ui-monospace, "SF Mono", Menlo, monospace; font-size: 12px; color: #c8cdd4; background: #1a1f26; padding: 3px 8px; border-radius: 4px; display: inline-block; }
  .det-row { display: flex; gap: 8px; margin-top: 8px; }
  .det-row strong { color: #8a8f98; font-weight: 500; min-width: 72px; font-size: 12px; }
  .det-row span { color: #e6e6e6; font-size: 13px; }
  .pill { display: inline-block; padding: 2px 8px; border-radius: 10px; font-size: 11px; font-weight: 500; margin-right: 4px; }
  .p-runtime { background: #1a3a2e; color: #6ee7a3; }
  .p-prompt { background: #3a2e1a; color: #f0b954; }
  .p-structural { background: #3a1a2e; color: #ff6b7a; }
  .loc { font-family: ui-monospace, "SF Mono", Menlo, monospace; font-size: 11px; color: #8a8f98; word-break: break-all; }
  .foot { margin-top: 32px; color: #6a7080; font-size: 12px; text-align: center; }
  @media print {
    body { background: #fff; color: #111; padding: 12mm; }
    .chart, .card { background: #fafbfc; border-color: #ddd; }
    .grid { stroke: #e8ebef; }
    .axis { stroke: #888; }
    .tick, .sub, .lg-count, #details.empty, .quad, .foot { fill: #666; color: #666; }
    .axis-label, .dot, .det-id, #details, .lg-row { fill: #111; color: #111; }
    .dot { stroke: #333; }
  }
</style>
</head>
<body>
<div class="wrap">
  <div>
    <h1>Operator Ω · Surface Tuning Map</h1>
    <div class="sub">${totalCount} tunables · diversity × accuracy plane · hover or click a dot for details</div>
    <div class="chart">
      <svg class="plot" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
        <g>${gridLines.join("")}</g>
        <g>${quadrants}</g>
        <g>${ticks.join("")}</g>
        <text class="axis-label" x="${M_LEFT + PLOT_W / 2}" y="${H - 20}" text-anchor="middle">diversity pull →</text>
        <text class="axis-label" x="${30}" y="${M_TOP + PLOT_H / 2}" text-anchor="middle" transform="rotate(-90 30 ${M_TOP + PLOT_H / 2})">accuracy pull →</text>
        <g>${dots.join("\n")}</g>
      </svg>
    </div>
    <div class="foot">Regenerate with <code>pnpm omega:tune:chart</code>. Source: packages/plugins/onboarding/src/tuning/registry.ts</div>
  </div>
  <div class="side">
    <div class="card">
      <h3>axis (color)</h3>
      ${axisLegendItems}
    </div>
    <div class="card">
      <h3>coupling (size)</h3>
      ${couplingLegend}
    </div>
    <div class="card" id="details-card">
      <h3>details</h3>
      <div id="details" class="empty">Hover or click a dot.</div>
    </div>
  </div>
</div>
<script>
  const details = document.getElementById("details");
  const dots = document.querySelectorAll(".dot");
  function show(el) {
    const d = el.dataset;
    details.classList.remove("empty");
    details.innerHTML = [
      '<div class="det-id">' + d.id + '</div>',
      '<div class="det-row"><strong>axis</strong><span>' + d.axis + '</span></div>',
      '<div class="det-row"><strong>phase</strong><span>' + d.phase + '</span></div>',
      '<div class="det-row"><strong>coupling</strong><span class="pill p-' + d.coupling + '">' + d.coupling + '</span></div>',
      '<div class="det-row"><strong>pulls</strong><span>div ' + (d.div >= 0 ? '+' : '') + d.div + ' · acc ' + (d.acc >= 0 ? '+' : '') + d.acc + '</span></div>',
      '<div class="det-row"><strong>desc</strong><span>' + d.desc + '</span></div>',
      '<div class="det-row"><strong>current</strong><span>' + d.current + '</span></div>',
      d.safe ? '<div class="det-row"><strong>safe</strong><span>' + d.safe + '</span></div>' : '',
      d.risk ? '<div class="det-row"><strong>risk</strong><span>' + d.risk + '</span></div>' : '',
      '<div class="det-row"><strong>where</strong><span class="loc">' + d.loc + '</span></div>',
    ].join('');
  }
  dots.forEach((el) => {
    el.addEventListener("mouseenter", () => show(el));
    el.addEventListener("click", () => {
      dots.forEach((d) => d.classList.remove("selected"));
      el.classList.add("selected");
      show(el);
    });
  });
</script>
</body>
</html>
`;
}

async function main() {
  const here = dirname(fileURLToPath(import.meta.url));
  const repoRoot = resolve(here, "..", "..", "..", "..", "..");
  const outPath = resolve(repoRoot, "docs", "ops", "surface-tuning-chart.html");
  await mkdir(dirname(outPath), { recursive: true });
  await writeFile(outPath, render(), "utf8");
  // eslint-disable-next-line no-console
  console.log(`wrote ${outPath} (${TUNABLES.length} tunables)`);
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
