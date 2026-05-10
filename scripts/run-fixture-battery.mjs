#!/usr/bin/env node
/**
 * Fixture battery — runs 10 diverse company onboardings end-to-end against
 * the running dev server, then writes a comparative report so we can judge
 * how well the swarm decision matrix + bridge catalog mapping selects
 * appropriate agents per company type.
 *
 * Usage:
 *   pnpm dev                                      # in another terminal
 *   node scripts/run-fixture-battery.mjs          # default: skipInference (T0 fast)
 *   node scripts/run-fixture-battery.mjs --with-t2  # real T2 (3-5 min/fixture)
 *   node scripts/run-fixture-battery.mjs --keep    # don't reset companies after
 *   node scripts/run-fixture-battery.mjs --only acme,pulse  # run a subset
 *
 * Requires the dev server (pnpm dev) running on http://127.0.0.1:3101.
 * Output: results/fixture-battery-<timestamp>.md
 */

import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

const args = process.argv.slice(2);
const WITH_T2 = args.includes("--with-t2");
const KEEP = args.includes("--keep");
const ONLY = (() => {
  const i = args.indexOf("--only");
  if (i < 0) return null;
  return new Set((args[i + 1] ?? "").split(",").map((s) => s.trim()).filter(Boolean));
})();
const API = process.env.WAVEX_API_BASE ?? "http://127.0.0.1:3101";

const SKIP_INFERENCE = !WITH_T2;
const PHASE_TIMEOUT_MS = WITH_T2 ? 240_000 : 30_000;

/* ──────────────────────────────────────────────────────────────────────────
 * Fixtures — 10 distinct company shapes designed to exercise the swarm
 * decision matrix across very different industry / stage / GTM signals.
 * ──────────────────────────────────────────────────────────────────────── */

const FIXTURES = [
  {
    id: "acme-saas-midmkt", tag: "acme",
    summary: "B2B SaaS · workflow automation · $1k-5k/mo · assisted demo · mid-market",
    pillar1: { org_name: "Acme Workflows",
      raw_input: "https://acme-workflows.example",
      manual_context: "Acme is a B2B SaaS workflow automation platform sold to mid-market ops teams. Pricing $1k-5k/mo, assisted demos, ~200 customers, growing 20% MoM." },
    pillar2: { claude_plan: "max_5x" },
    pillar3: { product_state: "live_paying_customers", stage: "10k_100k_mrr" },
    pillar4: { lead_sources: ["outbound_cold", "content_seo"], sales_motion: "assisted_demo", close_channel: "mostly_phone_video" },
    pillar5: { comm_channel: "telegram", urgency_routing: "all_to_one_channel" },
  },
  {
    id: "pulse-preprod", tag: "pulse",
    summary: "Pre-product · AI fitness coaching for solo trainers · idea_only · validating with interviews",
    pillar1: { org_name: "Pulse",
      raw_input: "no product yet",
      manual_context: "Pulse is a pre-product idea — exploring AI-driven fitness coaching for solo trainers. No code shipped, no paying customers, validating with interviews." },
    pillar2: { claude_plan: "max_5x" },
    pillar3: { product_state: "idea_only", stage: "pre_product" },
    pillar4: { lead_sources: ["none_yet"], sales_motion: "none_yet" },
    pillar5: { comm_channel: "telegram" },
  },
  {
    id: "ricoma-hardware", tag: "ricoma",
    summary: "Hardware manufacturer · commercial embroidery machines · DTC + dealer · existing $1M+ ARR",
    pillar1: { org_name: "Ricoma",
      raw_input: "https://ricoma.com",
      manual_context: "Ricoma manufactures and sells commercial embroidery machines (Chroma SaaS sidecar) to small custom-apparel businesses. Direct-to-consumer hardware sales with hardware financing. Multi-channel: dealer network + direct + ecom. ~$2M ARR." },
    pillar2: { claude_plan: "max_5x" },
    pillar3: { product_state: "live_paying_customers", stage: "1m_5m_arr" },
    pillar4: { lead_sources: ["content_seo", "inbound_ads_meta_google", "events"], sales_motion: "assisted_demo", close_channel: "mostly_phone_video" },
    pillar5: { comm_channel: "telegram", urgency_routing: "digest_plus_urgent_phone" },
  },
  {
    id: "rho-marketplace", tag: "rho",
    summary: "Two-sided marketplace · independent contractors connecting to small businesses · early traction",
    pillar1: { org_name: "Rho",
      raw_input: "https://rho-jobs.example",
      manual_context: "Rho is a two-sided marketplace connecting independent contractors (plumbers, electricians, HVAC) to small businesses needing recurring service. Take rate 12% on $200-2000 jobs. Currently in 3 metros, scaling to 10." },
    pillar2: { claude_plan: "max_5x" },
    pillar3: { product_state: "live_paying_customers", stage: "100k_500k_arr" },
    pillar4: { lead_sources: ["inbound_ads_meta_google", "outbound_cold", "partnerships"], sales_motion: "self_serve_plg", close_channel: "mixed" },
    pillar5: { comm_channel: "slack", urgency_routing: "digest_plus_urgent_phone" },
  },
  {
    id: "iris-edu", tag: "iris",
    summary: "EdTech · K-12 reading curriculum · district sales · long enterprise cycle",
    pillar1: { org_name: "Iris Reading Lab",
      raw_input: "https://irisreading.example",
      manual_context: "Iris Reading Lab provides a structured-literacy reading curriculum + assessment tooling for K-12 districts. Long sales cycles (6-12mo), pilot → district-wide rollout. Per-student licensing $40/yr. Used in 80 districts." },
    pillar2: { claude_plan: "max_5x" },
    pillar3: { product_state: "live_paying_customers", stage: "500k_1m_arr" },
    pillar4: { lead_sources: ["outbound_cold", "events", "partnerships"], sales_motion: "high_touch_enterprise", close_channel: "mostly_phone_video" },
    pillar5: { comm_channel: "email_only", urgency_routing: "all_to_one_channel" },
  },
  {
    id: "canopy-dtc", tag: "canopy",
    summary: "DTC e-commerce · clean skincare brand · paid ads + influencers · subscription + one-time",
    pillar1: { org_name: "Canopy",
      raw_input: "https://shopcanopy.example",
      manual_context: "Canopy is a DTC clean-skincare brand. Subscribe & save + one-time purchases. Heavy on Meta + TikTok paid ads + creator partnerships. ~30k email list, repeat rate 42%, AOV $68. Shopify Plus." },
    pillar2: { claude_plan: "max_5x" },
    pillar3: { product_state: "live_paying_customers", stage: "1m_5m_arr" },
    pillar4: { lead_sources: ["inbound_ads_meta_google", "partnerships", "content_seo"], sales_motion: "self_serve_plg", close_channel: "mixed" },
    pillar5: { comm_channel: "slack", urgency_routing: "digest_plus_urgent_phone" },
  },
  {
    id: "meridian-agency", tag: "meridian",
    summary: "B2B services · brand + product strategy consulting · retainer + project · founder-led sales",
    pillar1: { org_name: "Meridian Strategy",
      raw_input: "https://meridianstrategy.example",
      manual_context: "Meridian is a 12-person brand + product strategy consultancy. Retainer ($25k-80k/mo) + project ($75k-300k) work for late-stage startups + scaleups. Founder-led sales, referral-heavy pipeline." },
    pillar2: { claude_plan: "max_5x" },
    pillar3: { product_state: "live_paying_customers", stage: "1m_5m_arr" },
    pillar4: { lead_sources: ["referral_word_of_mouth", "content_seo", "events"], sales_motion: "high_touch_enterprise", close_channel: "mostly_phone_video" },
    pillar5: { comm_channel: "slack", urgency_routing: "all_to_one_channel" },
  },
  {
    id: "ironside-fintech", tag: "ironside",
    summary: "FinTech · embedded payments + reconciliation · regulated · enterprise procurement",
    pillar1: { org_name: "Ironside",
      raw_input: "https://ironside-pay.example",
      manual_context: "Ironside provides embedded payments + reconciliation infrastructure for vertical SaaS platforms. SOC2 Type 2, PCI-DSS Level 1. Sells to platforms doing $10M-$1B in flow. Long enterprise procurement (3-9mo)." },
    pillar2: { claude_plan: "max_5x" },
    pillar3: { product_state: "live_paying_customers", stage: "5m_10m_arr" },
    pillar4: { lead_sources: ["outbound_cold", "partnerships", "events"], sales_motion: "high_touch_enterprise", close_channel: "mostly_phone_video" },
    pillar5: { comm_channel: "slack", urgency_routing: "digest_plus_urgent_phone" },
  },
  {
    id: "vitalis-healthtech", tag: "vitalis",
    summary: "HealthTech · clinician burnout AI scribe · HIPAA · health-system sales",
    pillar1: { org_name: "Vitalis",
      raw_input: "https://vitalis-scribe.example",
      manual_context: "Vitalis is an AI medical scribe reducing clinician documentation burden in primary care + specialty clinics. HIPAA compliant, BAAs in place. Sells to health systems + medical groups. Pilot → multi-site rollout." },
    pillar2: { claude_plan: "max_5x" },
    pillar3: { product_state: "live_paying_customers", stage: "100k_500k_arr" },
    pillar4: { lead_sources: ["outbound_cold", "partnerships", "events"], sales_motion: "high_touch_enterprise", close_channel: "mostly_phone_video" },
    pillar5: { comm_channel: "email_only", urgency_routing: "digest_plus_urgent_phone" },
  },
  {
    id: "helix-opensource", tag: "helix",
    summary: "Open-source dev tool · CLI for vector data pipelines · community-led · cloud-hosted SaaS sidecar",
    pillar1: { org_name: "Helix",
      raw_input: "https://github.com/helix-vector/helix",
      manual_context: "Helix is an open-source CLI + library for managing vector data pipelines (embeddings, similarity search, eval harnesses). 8k GitHub stars, 200+ contributors. Monetizing via Helix Cloud — managed indexes + collaboration. ~$300k ARR." },
    pillar2: { claude_plan: "max_5x" },
    pillar3: { product_state: "live_paying_customers", stage: "100k_500k_arr" },
    pillar4: { lead_sources: ["content_seo", "content_seo", "partnerships"], sales_motion: "self_serve_plg", close_channel: "mixed" },
    pillar5: { comm_channel: "slack", urgency_routing: "all_to_one_channel" },
  },
];

/* ──────────────────────────────────────────────────────────────────────── */

const log = (...args) => console.log("[battery]", ...args);

async function api(method, path, body) {
  const init = { method };
  if (body !== undefined) {
    init.headers = { "Content-Type": "application/json" };
    init.body = JSON.stringify(body);
  }
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), PHASE_TIMEOUT_MS);
  try {
    const r = await fetch(`${API}${path}`, { ...init, signal: ctrl.signal });
    const text = await r.text();
    let json;
    try { json = JSON.parse(text); } catch { json = { raw: text.slice(0, 200) }; }
    if (!r.ok || (json && json.ok === false)) {
      throw new Error(`${method} ${path} → ${r.status} ${JSON.stringify(json).slice(0, 220)}`);
    }
    return json;
  } finally {
    clearTimeout(t);
  }
}

async function walkOne(fx) {
  const cid = fx.id;
  log(`  pillar 1 ${fx.tag}…`);
  await api("POST", "/op-omega/onboarding/pillar/1", {
    companyId: cid, org_name: fx.pillar1.org_name,
    raw_input: fx.pillar1.raw_input, manual_context: fx.pillar1.manual_context,
  });
  log(`  pillar 2 ${fx.tag}…`);
  await api("POST", "/op-omega/onboarding/pillar/2", { companyId: cid, claude_plan: fx.pillar2.claude_plan });
  log(`  pillar 3 ${fx.tag}…`);
  await api("POST", "/op-omega/onboarding/pillar/3", { companyId: cid, product_state: fx.pillar3.product_state, stage: fx.pillar3.stage });
  log(`  pillar 4 ${fx.tag}…`);
  await api("POST", "/op-omega/onboarding/pillar/4", { companyId: cid, lead_sources: fx.pillar4.lead_sources, sales_motion: fx.pillar4.sales_motion, close_channel: fx.pillar4.close_channel });
  log(`  pillar 5 ${fx.tag}…`);
  await api("POST", "/op-omega/onboarding/pillar/5", { companyId: cid, comm_channel: fx.pillar5.comm_channel, urgency_routing: fx.pillar5.urgency_routing });

  log(`  phase: connector ${fx.tag}…`);
  const conn = await api("POST", "/op-omega/onboarding/connector-manifest", { companyId: cid, skipInference: SKIP_INFERENCE });
  log(`  phase: swarm ${fx.tag}…`);
  const swarm = await api("POST", "/op-omega/onboarding/swarm-manifest", { companyId: cid, skipInference: SKIP_INFERENCE });
  log(`  phase: workflow ${fx.tag}…`);
  await api("POST", "/op-omega/onboarding/workflow-manifest", { companyId: cid, skipInference: SKIP_INFERENCE, bypassBudgetCheck: true });

  // Skip every required credential for the battery (we don't have real ones)
  const list = await api("GET", `/op-omega/onboarding/credentials/${encodeURIComponent(cid)}`);
  for (const c of list.connectors) {
    if (c.bucket === "required" && c.status === "pending") {
      await api("POST", "/op-omega/onboarding/credentials/skip", { companyId: cid, connectorId: c.connectorId, reason: "fixture-battery: no real credentials" });
    }
  }

  log(`  finalize ${fx.tag}…`);
  const fin = await api("POST", "/op-omega/onboarding/finalize", { companyId: cid, orgId: cid, skipInference: SKIP_INFERENCE, mc: { horizon_cycles: 5, n_runs: 5, seed: 42 } });

  log(`  activate ${fx.tag}…`);
  const act = await api("POST", `/api/instance/${encodeURIComponent(cid)}/activate`);

  log(`  fetching agents ${fx.tag}…`);
  const agentsResp = await api("GET", `/api/agents?companyId=${encodeURIComponent(cid)}`);

  return {
    fixture: fx,
    connector_required: conn.manifest.required.map((e) => e.id),
    connector_suggested: conn.manifest.suggested.map((e) => e.id),
    connector_deferred: conn.manifest.deferred.map((e) => e.id),
    topology: swarm.manifest.topology,
    finalize_sha: fin.sha256,
    finalize_source: fin.source,
    activate: act.inserted,
    agents: agentsResp.agents,
  };
}

function statusSymbol(s) {
  if (s === "ready") return "✓";
  if (s === "pending") return "○";
  if (s === "spawning") return "…";
  if (s === "failed") return "✗";
  return "?";
}

function reportFor(results) {
  const lines = [];
  lines.push(`# Fixture Battery — ${results.length} variants`);
  lines.push(``);
  lines.push(`Generated: ${new Date().toISOString()}`);
  lines.push(`Mode: ${WITH_T2 ? "**real T2 inference**" : "skipInference (T0 fast)"}`);
  lines.push(``);
  lines.push(`## Cross-fixture summary`);
  lines.push(``);
  lines.push(`| Tag | Industry shape | Required | Suggested | Active | Standby | Parked | Disabled |`);
  lines.push(`|---|---|---|---|---|---|---|---|`);
  for (const r of results) {
    lines.push(
      `| **${r.fixture.tag}** | ${r.fixture.summary.slice(0, 60)}… | ${r.connector_required.length} | ${r.connector_suggested.length} | ${r.topology.active_count} | ${r.topology.standby_count ?? 0} | ${r.topology.parked_count} | ${r.topology.disabled_count} |`
    );
  }
  lines.push(``);

  // Per-slot template selection matrix (only show slots that varied or that
  // every fixture has). We compare templateId and status across the 10.
  const allSlots = new Set();
  for (const r of results) for (const a of r.agents) allSlots.add(a.slot);
  const slotsSorted = [...allSlots].sort();

  lines.push(`## Per-slot template selection across all fixtures`);
  lines.push(``);
  lines.push(`| Slot | ${results.map((r) => r.fixture.tag).join(" | ")} |`);
  lines.push(`|---|${results.map(() => "---").join("|")}|`);
  for (const slot of slotsSorted) {
    const cells = results.map((r) => {
      const a = r.agents.find((x) => x.slot === slot);
      if (!a) return "—";
      return `${statusSymbol(a.status)} ${a.templateId}`;
    });
    lines.push(`| \`${slot}\` | ${cells.join(" | ")} |`);
  }
  lines.push(``);

  // Per-fixture deep dive
  for (const r of results) {
    lines.push(`---`);
    lines.push(`## \`${r.fixture.tag}\` — ${r.fixture.summary}`);
    lines.push(``);
    lines.push(`**Pillar inputs**`);
    lines.push(`- Pillar 1: ${r.fixture.pillar1.org_name} · ${r.fixture.pillar1.raw_input}`);
    lines.push(`  > ${r.fixture.pillar1.manual_context}`);
    lines.push(`- Pillar 3: product_state=${r.fixture.pillar3.product_state} · stage=${r.fixture.pillar3.stage}`);
    lines.push(`- Pillar 4: lead_sources=[${r.fixture.pillar4.lead_sources.join(", ")}] · sales_motion=${r.fixture.pillar4.sales_motion} · close_channel=${r.fixture.pillar4.close_channel ?? "—"}`);
    lines.push(`- Pillar 5: comm_channel=${r.fixture.pillar5.comm_channel} · urgency=${r.fixture.pillar5.urgency_routing ?? "—"}`);
    lines.push(``);
    lines.push(`**Connectors**`);
    lines.push(`- Required (${r.connector_required.length}): ${r.connector_required.join(", ") || "—"}`);
    lines.push(`- Suggested (${r.connector_suggested.length}): ${r.connector_suggested.join(", ") || "—"}`);
    lines.push(`- Deferred (${r.connector_deferred.length}): ${r.connector_deferred.join(", ") || "—"}`);
    lines.push(``);
    lines.push(`**Swarm topology**`);
    lines.push(`- Active: ${r.topology.active_count} · Standby: ${r.topology.standby_count ?? 0} · Parked: ${r.topology.parked_count} · Disabled: ${r.topology.disabled_count}`);
    lines.push(`- Total slots: ${r.topology.total_base_roster}`);
    lines.push(``);
    lines.push(`**Activated fleet (${r.activate.agents} rows in DB)**`);
    lines.push(``);
    lines.push(`| Slot | Display | Template | Status | Reports to |`);
    lines.push(`|---|---|---|---|---|`);
    const sortedAgents = [...r.agents].sort((a, b) => a.slot.localeCompare(b.slot));
    for (const a of sortedAgents) {
      const display = a.templateId.split("-").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
      lines.push(`| \`${a.slot}\` | ${display} | \`${a.templateId}\` | ${statusSymbol(a.status)} ${a.status} | ${a.reportsToSlot ?? "—"} |`);
    }
    lines.push(``);
    lines.push(`Manifest sha256: \`${r.finalize_sha}\` · finalize source: ${r.finalize_source}`);
    lines.push(``);
  }

  return lines.join("\n");
}

/* ──────────────────────────────────────────────────────────────────────── */

async function main() {
  const target = ONLY ? FIXTURES.filter((f) => ONLY.has(f.tag)) : FIXTURES;
  log(`Running ${target.length} fixture${target.length === 1 ? "" : "s"} (${WITH_T2 ? "real T2" : "T0 fast"})`);

  const startAll = Date.now();
  const results = [];
  for (const fx of target) {
    log(`▶ ${fx.tag} (${fx.summary})`);
    const start = Date.now();
    try {
      const r = await walkOne(fx);
      r.duration_ms = Date.now() - start;
      results.push(r);
      log(`✓ ${fx.tag} done in ${(r.duration_ms / 1000).toFixed(1)}s — ${r.activate.agents} agents activated`);
    } catch (e) {
      log(`✗ ${fx.tag} failed: ${e.message}`);
      results.push({ fixture: fx, error: e.message, duration_ms: Date.now() - start });
    }
  }
  const totalSec = ((Date.now() - startAll) / 1000).toFixed(1);
  log(`Total: ${totalSec}s · ${results.filter((r) => !r.error).length}/${target.length} succeeded`);

  // Drop failures from report; surface them in console
  const ok = results.filter((r) => !r.error);
  const failed = results.filter((r) => r.error);
  if (failed.length > 0) {
    log(`Failures:`);
    for (const f of failed) log(`  - ${f.fixture.tag}: ${f.error}`);
  }

  if (ok.length > 0) {
    const md = reportFor(ok);
    const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, -5);
    const outDir = path.join(ROOT, "results");
    mkdirSync(outDir, { recursive: true });
    const outPath = path.join(outDir, `fixture-battery-${stamp}.md`);
    writeFileSync(outPath, md);
    log(`Report → ${path.relative(ROOT, outPath)}`);
  }

  // Cleanup unless --keep
  if (!KEEP) {
    log(`Resetting fixtures…`);
    for (const r of results) {
      try {
        await api("DELETE", `/api/instance/${encodeURIComponent(r.fixture.id)}/reset`);
      } catch { /* best effort */ }
    }
  }

  process.exit(failed.length > 0 ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
