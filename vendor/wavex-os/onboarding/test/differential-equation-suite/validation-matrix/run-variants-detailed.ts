/**
 * OPΩ-ONB · Per-variant detailed report writer.
 *
 * Runs each validation-matrix fixture through the full pipeline (live T2)
 * and writes a rich markdown file per variant capturing the output at EVERY
 * phase. Use this to audit the surface by actually reading what the system
 * produces for each operator, not just aggregate divergence scores.
 *
 * Output lands at:
 *   report/variants/{fixture_id}.md
 *
 * Usage:
 *   pnpm test:variants-detailed          # live T2
 *   pnpm test:variants-detailed --dry    # deterministic baseline
 */

import { readdir, writeFile, mkdir } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  runOnboardingPipeline,
  type OnboardingFixture,
  loadFixture,
} from "../harness/run-onboarding-pipeline.js";
import { selectMCModel } from "@wavex-os/plugin-flywheel-kernel";

type StrategyId =
  | "CAPITAL_EFFICIENT"
  | "BALANCED"
  | "RETENTION_FIRST"
  | "ACQUISITION_HEAVY"
  | "NARRATIVE_LED"
  | string;

const STRATEGY_DISPLAY: Record<string, { display_name: string; one_line: string }> = {
  CAPITAL_EFFICIENT: {
    display_name: "Runway-first",
    one_line: "Preserve capital while validating product-market fit",
  },
  BALANCED: {
    display_name: "Balanced growth",
    one_line: "Proportional investment across acquisition, retention, and efficiency",
  },
  RETENTION_FIRST: {
    display_name: "Retention-led",
    one_line: "Expand and protect existing customers before growing top of funnel",
  },
  ACQUISITION_HEAVY: {
    display_name: "Growth-first",
    one_line: "Aggressive top-of-funnel investment, higher variance",
  },
  NARRATIVE_LED: {
    display_name: "Positioning-led",
    one_line: "Content and category definition as the primary growth lever",
  },
};

const BUNDLE_NAMES: Record<string, string> = {
  insight_activation: "Customer insight & activation",
  pipeline_velocity: "Pipeline & conversion",
  expansion_engine: "Retention & expansion",
  unit_economics: "Efficiency & runway",
  strategic_positioning: "Positioning & narrative",
};

const CONNECTOR_FRIENDLY: Record<string, string> = {
  "claude-code": "Claude Code (inference)",
  "supabase": "Supabase (data + auth)",
  "github": "GitHub (code + ship events)",
  "slack": "Slack (Board notifications)",
  "telegram": "Telegram (Board notifications)",
  "whatsapp": "WhatsApp (Board notifications)",
  "mixpanel": "Mixpanel (product analytics)",
  "segment": "Segment (analytics pipe)",
  "shopify": "Shopify (store-of-record)",
  "hubspot": "HubSpot (CRM)",
  "plaid": "Plaid (compliant banking data)",
  "posthog": "PostHog (self-hosted product analytics)",
  "meta-ads-api": "Meta Ads (attribution)",
  "google-ads-api": "Google Ads (attribution)",
  "linkedin-sales-nav": "LinkedIn Sales Navigator",
  "twilio-sms": "Twilio SMS",
};

function fmtConnector(id: string): string {
  return CONNECTOR_FRIENDLY[id] ?? id;
}

function fmtStage(stage: string | undefined): string {
  if (!stage) return "unknown";
  const map: Record<string, string> = {
    pre_product: "Pre-product",
    pre_launch: "Pre-launch",
    soft_launched: "Soft-launched",
    less_than_10k_mrr: "< $10k MRR",
    "10k_100k_mrr": "$10k–$100k MRR",
    "100k_1m_mrr": "$100k–$1M MRR",
    more_than_1m_mrr: "> $1M MRR",
  };
  return map[stage] ?? stage;
}

function fmtMcProjection(stage: string, winner: { mean_mrr_growth: number; p_ruin: number; sharpe: number; mean_cycles_to_critical: number | null }, mode: string): string {
  if (mode === "pre_scale") {
    const safety = winner.p_ruin < 0.1 ? "high" : winner.p_ruin < 0.25 ? "moderate" : "at risk";
    return `At pre-scale operators the simulator holds MRR flat — the number that matters is capital preservation. Runway is **${safety}** (p(ruin) ${(winner.p_ruin * 100).toFixed(0)}%).`;
  }
  if (mode === "scale") {
    return `At scale, the model emphasizes NRR and expansion efficiency. Projected 30-cycle trajectory reflects compounded expansion revenue.`;
  }
  const growth = `${(winner.mean_mrr_growth * 100).toFixed(0)}%`;
  const confidence = winner.sharpe >= 0.5 ? "high" : winner.sharpe >= 0.2 ? "moderate" : "limited";
  return `Projected 30-cycle MRR growth: **${growth}** · confidence: ${confidence} (sharpe ${winner.sharpe.toFixed(2)}).`;
}

async function writeVariantReport(fixture: OnboardingFixture, reportDir: string, live: boolean): Promise<string> {
  const result = await runOnboardingPipeline(fixture, { skipInference: !live });
  const lines: string[] = [];
  const push = (s: string) => lines.push(s);
  const br = () => lines.push("");

  push(`# Variant report · ${fixture.fixture_id}`);
  br();
  push(`*Pipeline mode:* ${live ? "**LIVE T2**" : "deterministic baseline"}`);
  push(`*Fixture description:* ${fixture.description ?? "—"}`);
  br();

  // Input summary
  push(`## Operator inputs (Pillars 1–5)`);
  br();
  push(`- **Company:** ${fixture.pillar_1?.org_name} · \`${fixture.pillar_1?.input}\``);
  push(`- **Claude plan:** ${fixture.pillar_2?.claude_plan}`);
  push(`- **Stage:** ${fixture.pillar_3?.product_state} · ${fmtStage(fixture.pillar_3?.stage)}`);
  const leadSources = (fixture.pillar_4 as { lead_sources?: string[]; lead_source?: string } | undefined)?.lead_sources
    ?? ((fixture.pillar_4 as { lead_source?: string } | undefined)?.lead_source ? [(fixture.pillar_4 as { lead_source: string }).lead_source] : []);
  push(`- **Lead sources:** ${leadSources.join(", ") || "—"}`);
  push(`- **Sales motion:** ${fixture.pillar_4?.sales_motion ?? "—"}`);
  push(`- **Board comms:** ${fixture.pillar_5?.comm_channel}${fixture.pillar_5?.urgency_routing ? ` · ${fixture.pillar_5.urgency_routing}` : ""}`);
  br();

  if (result.halted.kind !== "success") {
    push(`## ⚠ Pipeline halted`);
    br();
    push(`Pipeline did not complete: **${result.halted.kind}**`);
    const reason = (result.halted as { fixHint?: string; reason?: string }).fixHint ?? (result.halted as { reason?: string }).reason;
    if (reason) push(`\n> ${reason}`);
    br();
    const path = join(reportDir, `${fixture.fixture_id}.md`);
    await writeFile(path, lines.join("\n") + "\n", "utf8");
    return path;
  }

  // Phase 1 · Pillar 1 enrichment
  const p1 = result.pillarResponses.pillar_1;
  push(`## Phase 1 · Pillar 1 enrichment`);
  br();
  if (p1) {
    push(`- **Enrichment status:** \`${p1.enrichment_status ?? "enriched"}\``);
    push(`- **Industry hint:** ${p1.industry_hint}`);
    push(`- **Business model:** ${p1.business_model_hint}`);
    push(`- **Has product:** ${p1.has_product ? "yes" : "no"}`);
    push(`- **Ideal customer profile:** ${p1.ideal_customer_profile ?? "—"}`);
    push(`- **Revenue model:** ${p1.revenue_model ?? "—"}`);
    push(`- **Competitive position:** ${p1.competitive_position ?? "—"}`);
    push(`- **Primary acquisition channel:** ${p1.primary_acquisition_channel ?? "—"}`);
    push(`- **Product maturity signal:** ${p1.product_maturity_signal ?? "—"}`);
    push(`- **Tone signal:** ${p1.tone_signal ?? "—"}`);
    if (p1.primary_friction_hypothesis) {
      push(`- **Primary friction hypothesis:** ${p1.primary_friction_hypothesis}`);
    }
    if (p1.differentiator_hypothesis) {
      push(`- **Differentiator hypothesis:** ${p1.differentiator_hypothesis}`);
    }
    br();
    push(`**Company context:**`);
    push(`> ${p1.company_context.replace(/\n/g, "\n> ")}`);
  }
  br();

  // Phase 2 · Connector manifest
  const cm = result.connectorManifest;
  push(`## Phase 2 · Connector manifest`);
  br();
  push(`*Source: ${cm.generated_by}*`);
  br();
  push(`| Bucket | Count | Connectors |`);
  push(`|---|---:|---|`);
  push(`| Required | ${cm.required.length} | ${cm.required.map((e) => `\`${e.id}\``).join(", ") || "—"} |`);
  push(`| Suggested | ${cm.suggested.length} | ${cm.suggested.map((e) => `\`${e.id}\``).join(", ") || "—"} |`);
  push(`| Deferred | ${cm.deferred.length} | ${cm.deferred.map((e) => `\`${e.id}\``).join(", ") || "—"} |`);
  push(`| Blocked on approval | ${cm.blocked_on_manual_approval.length} | ${cm.blocked_on_manual_approval.map((e) => `\`${e.id}\``).join(", ") || "—"} |`);
  br();

  push(`### Required — details`);
  br();
  push(`| ID | Priority | Status | Dry-run | Rationale |`);
  push(`|---|---|---|---|---|`);
  for (const r of cm.required) {
    push(`| ${fmtConnector(r.id)} | ${r.priority} | ${r.status} | ${r.dry_run === undefined ? "—" : r.dry_run ? "yes" : "no"} | ${r.rationale} |`);
  }
  br();

  if (cm.suggested.length > 0) {
    push(`### Suggested — details`);
    br();
    push(`| ID | Priority | Status | Rationale |`);
    push(`|---|---|---|---|`);
    for (const r of cm.suggested) {
      push(`| ${fmtConnector(r.id)} | ${r.priority} | ${r.status} | ${r.rationale} |`);
    }
    br();
  }

  if (cm.blocked_on_manual_approval.length > 0) {
    push(`### Blocked on manual approval`);
    br();
    for (const b of cm.blocked_on_manual_approval) {
      push(`- **${fmtConnector(b.id)}** — ${b.reason}`);
    }
    br();
  }

  // Phase 3 · Swarm manifest
  const sm = result.swarmManifest;
  push(`## Phase 3 · Swarm manifest`);
  br();
  push(`*Source: ${sm.generated_by}*`);
  br();
  push(`### Topology`);
  push(`- Total base roster: **${sm.topology.total_base_roster}**`);
  push(`- Active: **${sm.topology.active_count}**`);
  push(`- Standby: ${sm.topology.standby_count ?? 0}`);
  push(`- Parked: ${sm.topology.parked_count}`);
  push(`- Disabled: ${sm.topology.disabled_count}`);
  br();

  push(`### Bundle allocation`);
  br();
  push(`| Bundle | Weight |`);
  push(`|---|---:|`);
  for (const [bundle, weight] of Object.entries(sm.bundle_allocation_initial)) {
    push(`| ${BUNDLE_NAMES[bundle] ?? bundle} | ${(weight * 100).toFixed(0)}% |`);
  }
  br();

  // Agents grouped by status
  const agentsByStatus: Record<string, Array<{ id: string; dept: string; level: string; skill_overlay: string | null; unpark_condition?: string; waiting_on_connector?: string; reason?: string; spawnable: boolean }>> = {
    active: [], standby: [], parked: [], disabled: [],
  };
  for (const [id, a] of Object.entries(sm.agents)) {
    (agentsByStatus[a.status] ?? []).push({
      id,
      dept: a.department,
      level: a.level,
      skill_overlay: a.skill_overlay,
      unpark_condition: a.unpark_condition,
      waiting_on_connector: a.waiting_on_connector,
      reason: a.reason,
      spawnable: a.spawnable,
    });
  }
  const sortByDept = (xs: typeof agentsByStatus["active"]): typeof agentsByStatus["active"] =>
    [...xs].sort((a, b) => a.dept.localeCompare(b.dept) || a.id.localeCompare(b.id));

  push(`### Active agents (${agentsByStatus.active.length})`);
  br();
  push(`| Agent | Department | Level | S+ | Skill overlay |`);
  push(`|---|---|---|:-:|---|`);
  for (const a of sortByDept(agentsByStatus.active)) {
    push(`| \`${a.id}\` | ${a.dept} | ${a.level} | ${a.spawnable ? "✓" : ""} | ${a.skill_overlay ?? "—"} |`);
  }
  br();

  if (agentsByStatus.standby.length > 0) {
    push(`### Standby (${agentsByStatus.standby.length}) — waiting on connectors`);
    br();
    push(`| Agent | Waiting on |`);
    push(`|---|---|`);
    for (const a of sortByDept(agentsByStatus.standby)) {
      push(`| \`${a.id}\` | ${a.waiting_on_connector ?? "—"} |`);
    }
    br();
  }

  if (agentsByStatus.parked.length > 0) {
    push(`### Parked (${agentsByStatus.parked.length}) — not needed yet`);
    br();
    push(`| Agent | Unpark condition |`);
    push(`|---|---|`);
    for (const a of sortByDept(agentsByStatus.parked)) {
      push(`| \`${a.id}\` | ${a.unpark_condition ?? "—"} |`);
    }
    br();
  }

  if (agentsByStatus.disabled.length > 0) {
    push(`### Disabled (${agentsByStatus.disabled.length}) — not relevant`);
    br();
    push(`| Agent | Reason |`);
    push(`|---|---|`);
    for (const a of sortByDept(agentsByStatus.disabled)) {
      push(`| \`${a.id}\` | ${a.reason ?? "—"} |`);
    }
    br();
  }

  if (sm.spawn_eligibility.length > 0) {
    push(`### Spawn eligibility (S+)`);
    br();
    for (const s of sm.spawn_eligibility) {
      push(`- **\`${s.agent}\`** — ${s.rationale}`);
    }
    br();
  }

  // Phase 4 · Workflow manifest
  const wm = result.workflowManifest;
  push(`## Phase 4 · Workflow manifest`);
  br();
  push(`*Source: ${wm.generated_by}*`);
  br();
  push(`- Agent workflows: ${Object.keys(wm.agent_workflows).length}`);
  push(`- Bundle workflows: ${Object.keys(wm.bundle_workflows).length}`);
  push(`- Dry-run gates: **${wm.dry_run_gates.length}**`);
  push(`- T2 patches applied: **${(wm.t2_patches ?? []).length}**`);
  br();

  if ((wm.t2_patches ?? []).length > 0) {
    push(`### T2 patches — per-agent attribution`);
    br();
    push(`| Agent | Changed | Pillar signal | Rationale |`);
    push(`|---|---|---|---|`);
    for (const p of wm.t2_patches!) {
      push(`| \`${p.agent_id}\` | ${p.changed_fields.join(", ")} | \`${p.pillar_signal}\` | ${p.rationale} |`);
    }
    br();
  }

  push(`### Bundle workflows`);
  br();
  push(`| Bundle | Owner | Cycle | KPIs moved |`);
  push(`|---|---|---|---|`);
  for (const [id, b] of Object.entries(wm.bundle_workflows)) {
    push(`| ${BUNDLE_NAMES[id] ?? id} | \`${b.owner}\` | ${b.cycle_length} | ${b.kpis_moved.join(", ")} |`);
  }
  br();

  // Per-agent workflow detail (active agents only — cap to avoid explosion)
  const activeWorkflows = Object.entries(wm.agent_workflows).filter(([id]) => sm.agents[id]?.status === "active");
  push(`### Active-agent workflows (${activeWorkflows.length})`);
  br();
  for (const [id, wf] of activeWorkflows) {
    push(`**\`${id}\`** — heartbeat ${wf.heartbeat}`);
    br();
    if (wf.on_fire.length > 0) {
      push(`| # | Task | Tier | Flow | Dry-run | Connector |`);
      push(`|---:|---|---|---|:-:|---|`);
      wf.on_fire.forEach((t, i) => {
        push(`| ${i + 1} | ${t.task} | ${t.tier ?? "—"} | ${t.flow_type ?? "—"} | ${t.dry_run_gate ? "gated" : "—"} | ${t.connector ?? "—"} |`);
      });
      br();
    }
    if (wf.escalation.length > 0) {
      push(`_Escalations:_`);
      for (const e of wf.escalation) {
        push(`- \`${e.on}\` → \`${e.to}\``);
      }
      br();
    }
  }

  if (wm.dry_run_gates.length > 0) {
    push(`### Dry-run gates (${wm.dry_run_gates.length})`);
    br();
    for (const g of wm.dry_run_gates) {
      push(`- \`${g}\``);
    }
    br();
  }

  // Finalize · MC + imprint
  const cmf = result.companyManifest;
  const stage = fixture.pillar_3?.stage ?? "";
  const mode = selectMCModel(stage);
  const winner = cmf.mc_winner;
  const display = STRATEGY_DISPLAY[winner.strategy_id] ?? { display_name: winner.strategy_id, one_line: "—" };
  push(`## Finalize · strategy review`);
  br();
  push(`### Monte Carlo winner`);
  push(`- **Strategy:** ${display.display_name} _(${winner.strategy_id})_`);
  push(`- _${display.one_line}_`);
  push(`- **Mode:** \`${mode}\``);
  push(`- ${fmtMcProjection(stage, winner, mode)}`);
  br();
  push(`**Rationale:**`);
  push(`> ${winner.rationale}`);
  br();

  push(`### Imprint review`);
  br();
  push(cmf.imprint_summary.split("\n\n").map((p) => `> ${p.replace(/\n/g, "\n> ")}`).join("\n>\n"));
  br();

  push(`### Dry-run window`);
  push(`- Dry-run on: **${cmf.dry_run.enabled}** · expires **${cmf.dry_run.expires_at}**`);
  push(`- Manifest hash: \`${cmf.signatures.manifest_hash}\``);
  br();

  // Timings + T2 calls
  push(`## Run metadata`);
  br();
  push(`| Phase | Elapsed (ms) |`);
  push(`|---|---:|`);
  for (const [phase, ms] of Object.entries(result.timings)) {
    push(`| ${phase} | ${ms} |`);
  }
  push(`| **Total T2 calls** | **${result.t2CallCount}** |`);
  br();

  const path = join(reportDir, `${fixture.fixture_id}.md`);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, lines.join("\n") + "\n", "utf8");
  return path;
}

async function main(): Promise<void> {
  const live = !process.argv.includes("--dry");
  if (!process.env.WAVEX_OS_PAPERCLIP_BASE_URL) {
    process.env.WAVEX_OS_PAPERCLIP_BASE_URL = "http://127.0.0.1:3101";
  }
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const fixturesDir = join(__dirname, "..", "fixtures", "validation-matrix");
  const reportDir = join(__dirname, "..", "report", "variants");
  await mkdir(reportDir, { recursive: true });

  const files = (await readdir(fixturesDir)).filter((f) => f.endsWith(".json")).sort();
  console.log(`Variant detailed reports · mode=${live ? "LIVE" : "dry"} · ${files.length} fixtures → ${reportDir}`);

  const paths: string[] = [];
  for (const f of files) {
    const path = join(fixturesDir, f);
    try {
      const fixture = (await loadFixture(path)) as OnboardingFixture;
      console.log(`[${new Date().toISOString()}] ▶ ${fixture.fixture_id}`);
      const outPath = await writeVariantReport(fixture, reportDir, live);
      paths.push(outPath);
      console.log(`[${new Date().toISOString()}] ✓ ${fixture.fixture_id} → ${outPath}`);
    } catch (err) {
      console.error(`[${new Date().toISOString()}] ✗ ${f} failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  // Write a top-level index
  const indexPath = join(reportDir, "INDEX.md");
  const indexLines: string[] = [];
  indexLines.push(`# Variant reports · validation matrix`);
  indexLines.push("");
  indexLines.push(`Mode: ${live ? "LIVE T2" : "deterministic baseline"}`);
  indexLines.push(`Generated: ${new Date().toISOString()}`);
  indexLines.push("");
  indexLines.push(`## Variants`);
  indexLines.push("");
  for (const p of paths) {
    const name = p.split("/").pop()!.replace(".md", "");
    indexLines.push(`- [${name}](./${name}.md)`);
  }
  await writeFile(indexPath, indexLines.join("\n") + "\n", "utf8");
  console.log(`\nIndex: ${indexPath}`);
}

main().catch((err) => {
  console.error("run-variants-detailed failed:", err);
  process.exit(1);
});
