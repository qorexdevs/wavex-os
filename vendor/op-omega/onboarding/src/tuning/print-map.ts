#!/usr/bin/env node
/**
 * Generates docs/ops/surface-tuning-map.md from TUNABLES.
 * Run: pnpm omega:tune:map
 */

import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { TUNABLES, type SurfaceAxis, type TuningPhase, type Tunable, type Pull } from "./registry.js";

const AXIS_ORDER: SurfaceAxis[] = [
  "active_agent_set",
  "overlay_tokens",
  "workflow_tasks",
  "bundle_allocation_l1",
  "connector_set",
  "dry_run_gates",
  "mc_winner",
  "mc_projection_l2",
];

const AXIS_LABELS: Record<SurfaceAxis, string> = {
  active_agent_set: "1 · Active agent set",
  overlay_tokens: "2 · Overlay tokens",
  workflow_tasks: "3 · Workflow tasks",
  bundle_allocation_l1: "4 · Bundle allocation (L1)",
  connector_set: "5 · Connector set",
  dry_run_gates: "6 · Dry-run gates",
  mc_winner: "7 · MC winner",
  mc_projection_l2: "8 · MC projection (L2)",
};

const PHASE_ORDER: TuningPhase[] = ["phase-2", "phase-3", "phase-4", "finalize"];

function pullCell(p: Pull): string {
  if (p > 0) return `+${p}`;
  if (p < 0) return `${p}`;
  return "0";
}

function escape(s: string): string {
  return s.replace(/\|/g, "\\|").replace(/\n/g, " ");
}

function rowFor(t: Tunable): string {
  const cols = [
    `\`${t.id}\``,
    t.coupling,
    pullCell(t.diversityPull),
    pullCell(t.accuracyPull),
    escape(t.currentValue),
    escape(t.description),
    t.safeRange ? escape(t.safeRange) : "—",
    t.risk ? escape(t.risk) : "—",
    `\`${t.location}\``,
  ];
  return `| ${cols.join(" | ")} |`;
}

function render(): string {
  const lines: string[] = [];
  lines.push("# Operator Ω · Surface Tuning Map");
  lines.push("");
  lines.push("> Auto-generated from `packages/plugins/onboarding/src/tuning/registry.ts`.");
  lines.push("> Regenerate with `pnpm omega:tune:map`. Do not edit by hand.");
  lines.push("");
  lines.push("## 2D framing");
  lines.push("");
  lines.push("- **Diversity pull** — how much raising this value widens per-operator variation (surface spread).");
  lines.push("- **Accuracy pull** — how much raising this value improves faithfulness to operator inputs.");
  lines.push("");
  lines.push("Both range `-2..+2`. A tunable with high diversity and low accuracy is a diversity dial; one with high accuracy and low diversity is a quality dial; one high in both is a rare free lunch; one low in both is dead weight.");
  lines.push("");
  lines.push("## Coupling");
  lines.push("");
  lines.push("- **runtime** — edit the constant, redeploy. No prompt or snapshot changes.");
  lines.push("- **prompt** — value is mirrored in a T2 prompt body. Bump the version in `CURRENT_PROMPT_VERSIONS` and refresh the snapshot under `test/differential-equation-suite/prompts/<phase>/v<ver>.md`, then run the drift detector.");
  lines.push("- **structural** — adding/removing an enum, strategy, or agent. Requires code + prompt + tests together.");
  lines.push("");
  lines.push(`Total tunables: **${TUNABLES.length}**.`);
  lines.push("");

  for (const axis of AXIS_ORDER) {
    const axisEntries = TUNABLES.filter((t) => t.axis === axis);
    if (axisEntries.length === 0) continue;
    lines.push(`## ${AXIS_LABELS[axis]}`);
    lines.push("");
    for (const phase of PHASE_ORDER) {
      const phaseEntries = axisEntries.filter((t) => t.phase === phase);
      if (phaseEntries.length === 0) continue;
      lines.push(`### ${phase}`);
      lines.push("");
      lines.push("| id | coupling | div | acc | current | description | safe range | risk | location |");
      lines.push("|---|---|---|---|---|---|---|---|---|");
      for (const t of phaseEntries) lines.push(rowFor(t));
      lines.push("");
    }
  }

  return lines.join("\n") + "\n";
}

async function main() {
  const here = dirname(fileURLToPath(import.meta.url));
  const repoRoot = resolve(here, "..", "..", "..", "..", "..");
  const outPath = resolve(repoRoot, "docs", "ops", "surface-tuning-map.md");
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
