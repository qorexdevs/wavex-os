#!/usr/bin/env node
/**
 * Phase 3 — provision the "WaveX Mission Control" admin Paperclip instance.
 *
 * A WaveX-internal Paperclip company whose agents oversee every paid customer
 * fleet + every Expert Agent (REDUNDANCY_ARCHITECTURE.md). Runs LOCAL on the
 * operator box — Paperclip needs the macOS keychain + a real login session,
 * so it cannot be cloud-hosted without a hosted Mac.
 *
 * Idempotent: re-running reuses the existing company + already-hired agents.
 * State is written to ~/.wavex-os/state/admin-instance.json.
 *
 * Agents (all wake-on-demand + a slow 1h fallback heartbeat — token-conscious;
 * the ops-cycle files issues into this company and that is what drives them):
 *   - Admin CEO          — triage + orchestration
 *   - Fleet Watchdog     — judgment over FLEET.* incidents
 *   - Expert QA          — verifies Expert Agents keep their promise
 *   - Incident Responder — runs the remediation playbooks
 *
 * After provisioning, point the ops-cycle at this company:
 *   export WAVEX_OPS_PAPERCLIP_COMPANY_ID=<printed company id>
 *
 * Env:
 *   PAPERCLIP_HANDOFF_URL          — default http://127.0.0.1:3100
 *   WAVEX_OS_STATE_DIR             — default ~/.wavex-os
 *   WAVEX_ADMIN_HEARTBEAT_SEC      — default 3600
 *   PAPERCLIP_HANDOFF_WRAPPER      — optional override of the auth wrapper
 *
 * Exit 0 on success or "already provisioned"; non-zero only on a real failure.
 */

import { promises as fs } from "node:fs";
import path from "node:path";
import { homedir } from "node:os";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, "..", "..");
const PAPERCLIP_URL = (process.env.PAPERCLIP_HANDOFF_URL ?? "http://127.0.0.1:3100").replace(/\/+$/, "");
const STATE_DIR = process.env.WAVEX_OS_STATE_DIR ?? path.join(homedir(), ".wavex-os");
const STATE_FILE = path.join(STATE_DIR, "state", "admin-instance.json");
const HEARTBEAT_SEC = Number(process.env.WAVEX_ADMIN_HEARTBEAT_SEC ?? 3600);
const WRAPPER = process.env.PAPERCLIP_HANDOFF_WRAPPER
  ?? path.join(REPO_ROOT, "scripts", "ops", "claude-keychain-wrapper.sh");
const AGENTS_DIR = path.join(HERE, "admin-instance", "agents");
const COMPANY_NAME = "WaveX Mission Control";

/** slug → { template file, display name, icon, reportsTo slug (null = top) } */
const AGENT_SPEC = [
  { slug: "admin-ceo", file: "admin-ceo.md", name: "Admin CEO", icon: "shield", reportsTo: null,
    capabilities: "Triage + orchestration for WaveX Mission Control — oversees paid-fleet health and Expert Agent delivery." },
  { slug: "fleet-watchdog", file: "fleet-watchdog.md", name: "Fleet Watchdog", icon: "eye", reportsTo: "admin-ceo",
    capabilities: "Judgment layer over the ops-cycle's mechanical FLEET.* checks — decides remediate vs escalate." },
  { slug: "expert-qa", file: "expert-qa.md", name: "Expert QA", icon: "search", reportsTo: "admin-ceo",
    capabilities: "Verifies Expert Agents keep their promise — injection delivery_score, acted-rate, fleet effectiveness." },
  { slug: "incident-responder", file: "incident-responder.md", name: "Incident Responder", icon: "wrench", reportsTo: "admin-ceo",
    capabilities: "Runs the remediation playbooks — applies fixes to operator-local instances, escalates customer-box incidents." },
  // Phase 5 — autonomous fix-application layer (issue #126).
  { slug: "customer-success-engineer", file: "customer-success-engineer.md", name: "Customer Success Engineer", icon: "heart", reportsTo: "admin-ceo",
    capabilities: "Per-customer issue resolution — diagnoses individual paying customers and either Pool-C-injects guidance to their Concierge Ops or escalates the failure to the operator." },
  { slug: "platform-reliability-engineer", file: "platform-reliability-engineer.md", name: "Platform Reliability Engineer", icon: "radar", reportsTo: "admin-ceo",
    capabilities: "Aggregate fleet + operator-local platform health — files P1 issues on fleet-wide regressions and SEV0 on operator-local launchd outages." },
  { slug: "build-engineer", file: "build-engineer.md", name: "Build Engineer", icon: "git-branch", reportsTo: "admin-ceo",
    capabilities: "Owns the wavex-os codebase: watches CI on main, watches customer-machine build failures, reviews PRs touching sensitive paths, ships fixes via Git Engineer." },
];

function log(...a) { console.log("[provision-admin]", ...a); }
function fail(msg) { console.error("[provision-admin] FATAL:", msg); process.exit(1); }

async function api(method, p, body) {
  const r = await fetch(`${PAPERCLIP_URL}${p}`, {
    method,
    headers: { "Content-Type": "application/json" },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const text = await r.text();
  let json;
  try { json = text ? JSON.parse(text) : null; } catch { json = { _raw: text }; }
  if (!r.ok) throw new Error(`${method} ${p} → ${r.status} ${text.slice(0, 300)}`);
  return json;
}

async function readState() {
  try { return JSON.parse(await fs.readFile(STATE_FILE, "utf8")); }
  catch { return null; }
}
async function writeState(state) {
  await fs.mkdir(path.dirname(STATE_FILE), { recursive: true });
  await fs.writeFile(STATE_FILE, JSON.stringify(state, null, 2) + "\n");
}

async function findOrCreateCompany() {
  const list = await api("GET", "/api/companies");
  const companies = Array.isArray(list) ? list : (list?.companies ?? []);
  const existing = companies.find((c) => c.name === COMPANY_NAME);
  if (existing) {
    log(`company exists: ${existing.id}`);
    return existing.id;
  }
  const created = await api("POST", "/api/companies", {
    name: COMPANY_NAME,
    description:
      "WaveX-internal oversight company. Its agents watch every paid customer " +
      "fleet and every Expert Agent. Driven by scripts/ops/wavex-ops-cycle.mjs.",
  });
  log(`company created: ${created.id}`);
  return created.id;
}

async function listAgents(companyId) {
  try {
    const r = await api("GET", `/api/companies/${companyId}/agents`);
    return Array.isArray(r) ? r : (r?.agents ?? []);
  } catch { return []; }
}

async function hireAgent(companyId, spec, bundleMd, reportsToId) {
  const payload = {
    name: spec.name,
    role: "general",
    title: spec.name,
    icon: spec.icon,
    capabilities: spec.capabilities,
    adapterType: "claude_local",
    adapterConfig: {
      command: WRAPPER,
      model: "claude-sonnet-4-6",
      dangerouslySkipPermissions: true,
      timeoutSec: 600,
      graceSec: 30,
      env: {
        HOME: { type: "plain", value: process.env.HOME ?? "" },
        USER: { type: "plain", value: process.env.USER ?? process.env.LOGNAME ?? "" },
        LOGNAME: { type: "plain", value: process.env.LOGNAME ?? process.env.USER ?? "" },
      },
    },
    instructionsBundle: { files: { "AGENTS.md": bundleMd } },
    runtimeConfig: { heartbeat: { enabled: true, intervalSec: HEARTBEAT_SEC, wakeOnDemand: true } },
    ...(reportsToId ? { reportsTo: reportsToId } : {}),
  };
  const res = await api("POST", `/api/companies/${companyId}/agent-hires`, payload);
  const agentId = res?.agent?.id;
  if (!agentId) throw new Error(`hire ${spec.slug}: no agent id in response`);
  if (res?.approval?.status === "pending") {
    try {
      await api("POST", `/api/approvals/${res.approval.id}/approve`, {
        decisionNote: "Auto-approved by provision-admin-instance.mjs (Phase 3)",
      });
    } catch (e) {
      log(`warn: auto-approve failed for ${spec.slug} — agent ${agentId} is pending: ${e.message}`);
    }
  }
  return agentId;
}

async function main() {
  log(`Paperclip: ${PAPERCLIP_URL}`);
  // Reachability check — fail clean if Paperclip is down.
  try { await api("GET", "/api/companies"); }
  catch (e) { fail(`Paperclip not reachable: ${e.message}`); }

  const companyId = await findOrCreateCompany();
  const prior = (await readState()) ?? {};
  const priorAgents = prior.companyId === companyId ? (prior.agents ?? {}) : {};

  // Reconcile against what Paperclip actually has, so a half-finished run heals.
  const live = await listAgents(companyId);
  const liveByName = new Map(live.map((a) => [a.name, a.id]));

  const agents = {};
  // CEO first — the workers report to it.
  for (const spec of AGENT_SPEC) {
    const known = priorAgents[spec.slug] || liveByName.get(spec.name);
    if (known) {
      log(`${spec.slug}: exists (${known})`);
      agents[spec.slug] = known;
      continue;
    }
    const bundleMd = await fs.readFile(path.join(AGENTS_DIR, spec.file), "utf8");
    const reportsToId = spec.reportsTo ? agents[spec.reportsTo] ?? null : null;
    const id = await hireAgent(companyId, spec, bundleMd, reportsToId);
    log(`${spec.slug}: hired (${id})`);
    agents[spec.slug] = id;
  }

  const state = {
    companyId,
    paperclipUrl: PAPERCLIP_URL,
    company_name: COMPANY_NAME,
    agents,
    heartbeat_sec: HEARTBEAT_SEC,
    updatedAt: new Date().toISOString(),
  };
  await writeState(state);
  log(`state written: ${STATE_FILE}`);

  console.log("");
  console.log("  WaveX Mission Control is provisioned.");
  console.log(`  company id : ${companyId}`);
  for (const [slug, id] of Object.entries(agents)) {
    console.log(`  ${slug.padEnd(20)} ${id}`);
  }
  console.log("");
  console.log("  Point the ops-cycle at it so CRIT findings escalate here:");
  console.log(`    export WAVEX_OPS_PAPERCLIP_COMPANY_ID=${companyId}`);
  console.log("");
}

main().catch((e) => fail(e.message));
