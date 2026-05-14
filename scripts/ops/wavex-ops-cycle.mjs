#!/usr/bin/env node
/**
 * WaveX Ops — operator-side reliability cycle.
 *
 * Runs every 15 min via launchd (com.wavex-os.ops-cycle). Separate from the
 * fleet's internal `system-reliability` agent: that one watches disk/RAM/
 * inference on the customer side. THIS watches operator-side signals across
 * all customers:
 *
 *   1. Manifest health         — companies with goal.kpiId=null, signed_at=null,
 *                                 or finalized_at older than 24h with no
 *                                 triggered-heartbeats.jsonl activity
 *   2. Stripe webhook arrival  — wavex_os.stripe_webhook_events; if >24h with
 *                                 NO new events AND active subscriptions exist,
 *                                 something is wrong with the Stripe wiring
 *   3. Pool A inference health — scan ~/.wavex-os/state/t2-events.jsonl, count
 *                                 non-zero exit_code in last 60 min
 *   4. Hub inference status    — check inference-status JSON freshness
 *   5. Catalog/hire mismatch   — agents in catalog with zero hires for >30d
 *   6. Paid-fleet health      — wavex_os_ops_fleet_health(): latest
 *                                instance_health per device. A PAID fleet
 *                                (pool_b + active sub) that is DOWN or DARK
 *                                (no health push in 30min) is CRIT — the
 *                                redundancy promise. Matched remediation
 *                                playbooks (scripts/ops/playbooks/) ride
 *                                along on the escalation.
 *
 * Output:
 *   - ALWAYS append a structured event to ~/.wavex-os/state/ops-events.jsonl.
 *     This is training data — NEVER cleaned by this script (operator-only).
 *   - On WARN/CRIT, log to ~/.wavex-os/state/wavex-ops-cycle.log too.
 *   - On CRIT, send Telegram if WAVEX_OPS_TELEGRAM_BOT_TOKEN +
 *     WAVEX_OPS_TELEGRAM_CHAT_ID env vars are set, otherwise quietly skip.
 *   - On CRIT, also POST a Paperclip issue if localhost:3100 is reachable
 *     (so the WaveX Ops fleet — if it exists — sees the alert).
 *
 * Exit 0 always (we never want launchd to back off our cadence on failures).
 *
 * Configurable env vars (read from inference.env and load-env.sh):
 *   - SUPABASE_URL                          — required for Stripe + sub checks
 *   - SUPABASE_SERVICE_ROLE_KEY             — required for the above
 *   - WAVEX_OPS_TELEGRAM_BOT_TOKEN          — optional, enables Telegram alerts
 *   - WAVEX_OPS_TELEGRAM_CHAT_ID            — optional, enables Telegram alerts
 *   - WAVEX_OPS_PAPERCLIP_URL               — defaults http://127.0.0.1:3100
 *   - WAVEX_OPS_PAPERCLIP_COMPANY_ID        — optional, target company for issues
 *   - WAVEX_OPS_STALE_HOURS                 — defaults 24 (manifest activity gap)
 *   - WAVEX_OPS_STRIPE_QUIET_HOURS          — defaults 24 (webhook arrival gap)
 *   - WAVEX_OPS_T2_ERROR_THRESHOLD_PCT      — defaults 25 (Pool A error rate)
 */

import { promises as fs } from "node:fs";
import path from "node:path";
import { homedir } from "node:os";
import { matchPlaybooks } from "./playbooks/index.mjs";

const STATE_DIR = process.env.WAVEX_OS_STATE_DIR ?? path.join(homedir(), ".wavex-os");
const EVENTS_FILE = path.join(STATE_DIR, "state", "ops-events.jsonl");
const LOG_FILE = path.join(STATE_DIR, "state", "wavex-ops-cycle.log");
const COMPANIES_DIR = path.join(STATE_DIR, "instances", "default", "companies");

const STALE_HOURS = Number(process.env.WAVEX_OPS_STALE_HOURS ?? 24);
const STRIPE_QUIET_HOURS = Number(process.env.WAVEX_OPS_STRIPE_QUIET_HOURS ?? 24);
const T2_ERROR_THRESHOLD_PCT = Number(process.env.WAVEX_OPS_T2_ERROR_THRESHOLD_PCT ?? 25);
// A paid fleet whose Liaison hasn't pushed instance_health in this many
// minutes is "dark" — we've lost visibility, treated as CRIT. The Liaison
// heartbeats every 10min, so 30min = 3 missed pushes.
const FLEET_DARK_MINUTES = Number(process.env.WAVEX_OPS_FLEET_DARK_MINUTES ?? 30);

const PAPERCLIP_URL = process.env.WAVEX_OPS_PAPERCLIP_URL ?? "http://127.0.0.1:3100";
const PAPERCLIP_COMPANY = process.env.WAVEX_OPS_PAPERCLIP_COMPANY_ID ?? "";
const TG_TOKEN = process.env.WAVEX_OPS_TELEGRAM_BOT_TOKEN ?? "";
const TG_CHAT = process.env.WAVEX_OPS_TELEGRAM_CHAT_ID ?? "";
const SB_URL = process.env.SUPABASE_URL ?? "";
const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

// ────────────────────────────────────────────────────────────────────────────
// Logging primitives

const cycleId = `ops-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const findings = [];

function record(severity, code, summary, detail = {}) {
  findings.push({ severity, code, summary, detail });
}

async function flush() {
  const rolled = {
    ts_iso: new Date().toISOString(),
    cycle_id: cycleId,
    findings_count: findings.length,
    severity_max: findings.reduce(
      (acc, f) => Math.max(acc, sevWeight(f.severity)),
      0,
    ),
    findings,
  };
  await fs.mkdir(path.dirname(EVENTS_FILE), { recursive: true });
  await fs.appendFile(EVENTS_FILE, JSON.stringify(rolled) + "\n");

  // Mirror WARN+ to log for grep-friendliness
  const logLines = findings
    .filter((f) => sevWeight(f.severity) >= sevWeight("WARN"))
    .map((f) => `[${new Date().toISOString()}] ${f.severity} ${f.code}: ${f.summary}`);
  if (logLines.length) {
    await fs.appendFile(LOG_FILE, logLines.join("\n") + "\n");
  }
  return rolled;
}

function sevWeight(s) {
  return { INFO: 0, WARN: 1, CRIT: 2 }[s] ?? 0;
}

// ────────────────────────────────────────────────────────────────────────────
// Notifiers (lazy, graceful)

async function notifyTelegram(text) {
  if (!TG_TOKEN || !TG_CHAT) return { sent: false, reason: "creds-missing" };
  try {
    const res = await fetch(
      `https://api.telegram.org/bot${TG_TOKEN}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: TG_CHAT,
          text,
          parse_mode: "Markdown",
          disable_web_page_preview: true,
        }),
      },
    );
    return { sent: res.ok, status: res.status };
  } catch (err) {
    return { sent: false, reason: String(err) };
  }
}

async function notifyPaperclip(title, body) {
  if (!PAPERCLIP_COMPANY) return { sent: false, reason: "no-company-configured" };
  try {
    const res = await fetch(
      `${PAPERCLIP_URL}/api/companies/${encodeURIComponent(PAPERCLIP_COMPANY)}/issues`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          description: body,
          priority: "high",
          labels: ["wavex-ops", "auto-filed"],
        }),
      },
    );
    return { sent: res.ok, status: res.status };
  } catch (err) {
    return { sent: false, reason: String(err) };
  }
}

// ────────────────────────────────────────────────────────────────────────────
// Probes

async function probeManifestHealth() {
  let companies = [];
  try {
    companies = await fs.readdir(COMPANIES_DIR);
  } catch {
    record("INFO", "MANIFEST.NO_COMPANIES", `${COMPANIES_DIR} not present yet`);
    return;
  }

  const now = Date.now();
  let scanned = 0;
  for (const id of companies) {
    if (id.startsWith(".")) continue;
    const manifestPath = path.join(
      COMPANIES_DIR, id, "onboarding", "company.manifest.json",
    );
    let manifest;
    try {
      manifest = JSON.parse(await fs.readFile(manifestPath, "utf8"));
    } catch {
      continue; // not finalized yet, OK
    }
    scanned++;

    const finalizedAt = manifest.finalized_at
      ? new Date(manifest.finalized_at).getTime() : 0;
    const ageHours = finalizedAt ? (now - finalizedAt) / 3_600_000 : 0;

    // (a) goal.kpiId nullness — was the operator-fix in 997a019b
    if (!manifest?.goal?.kpiId) {
      record("WARN", "MANIFEST.GOAL_NULL",
        `Company ${id} finalized but goal.kpiId is null`,
        { company_id: id, finalized_at: manifest.finalized_at });
    }

    // (b) signed_at nullness
    if (!manifest?.signed_at) {
      record("WARN", "MANIFEST.SIGNED_AT_NULL",
        `Company ${id} finalized but signed_at is null`,
        { company_id: id });
    }

    // (c) stale fleet — finalized >24h ago, no triggered heartbeats observed
    const triggersPath = path.join(
      COMPANIES_DIR, id, "onboarding", "triggered-heartbeats.jsonl",
    );
    let hasTrigger = false;
    try {
      const stat = await fs.stat(triggersPath);
      hasTrigger = stat.size > 0;
    } catch { /* never triggered, fine */ }

    if (ageHours > STALE_HOURS && !hasTrigger) {
      record("WARN", "MANIFEST.STALE_FLEET",
        `Company ${id} finalized ${ageHours.toFixed(1)}h ago, never triggered`,
        { company_id: id, finalized_at: manifest.finalized_at, age_hours: ageHours });
    }
  }
  record("INFO", "MANIFEST.SCAN_DONE", `Scanned ${scanned} finalized manifests`);
}

// Tiny helper to call a wavex_os_ops_* RPC via the public schema.
async function callOpsRpc(name, body = {}) {
  if (!SB_URL || !SB_KEY) return { ok: false, reason: "no-creds" };
  const r = await fetch(`${SB_URL}/rest/v1/rpc/${name}`, {
    method: "POST",
    headers: {
      apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!r.ok) {
    const text = await r.text().catch(() => "");
    return { ok: false, status: r.status, text: text.slice(0, 200) };
  }
  return { ok: true, data: await r.json() };
}

async function probeStripeWebhookArrival() {
  if (!SB_URL || !SB_KEY) {
    record("INFO", "STRIPE.SKIPPED", "Supabase creds not configured");
    return;
  }
  // Use the public RPCs we added in 20260513000012 — wavex_os schema is not
  // exposed via REST, so direct table queries get a 406. The RPCs are
  // SECURITY DEFINER + scoped to aggregate-only reads (no raw PII).
  const last = await callOpsRpc("wavex_os_ops_last_webhook_at");
  if (!last.ok) {
    record("WARN", "STRIPE.QUERY_FAILED",
      `RPC failed: ${last.status ?? last.reason} ${last.text ?? ""}`);
    return;
  }
  if (!last.data?.length) {
    record("INFO", "STRIPE.NO_EVENTS_EVER",
      "No stripe webhook events recorded yet");
    return;
  }
  const lastAt = new Date(last.data[0].processed_at).getTime();
  const gapHours = (Date.now() - lastAt) / 3_600_000;

  const subs = await callOpsRpc("wavex_os_ops_active_sub_count");
  const activeSubCount = subs.ok && typeof subs.data === "number" ? subs.data : 0;

  if (gapHours > STRIPE_QUIET_HOURS && activeSubCount > 0) {
    record("CRIT", "STRIPE.SILENT_WITH_ACTIVE_SUBS",
      `${gapHours.toFixed(1)}h since last Stripe webhook AND ${activeSubCount} active subs exist`,
      { gap_hours: gapHours, active_sub_count: activeSubCount });
  } else if (gapHours > STRIPE_QUIET_HOURS) {
    record("INFO", "STRIPE.QUIET_NO_ACTIVES",
      `${gapHours.toFixed(1)}h quiet but no active subs`);
  } else {
    record("INFO", "STRIPE.RECENT",
      `Last webhook ${gapHours.toFixed(1)}h ago (${last.data[0].type})`);
  }

  // Also surface recent webhook errors in the same probe block.
  const errs = await callOpsRpc("wavex_os_ops_recent_webhook_errors", { p_hours: 24 });
  if (errs.ok && errs.data?.[0]) {
    const { error_count, types } = errs.data[0];
    if (error_count > 0) {
      record("WARN", "STRIPE.WEBHOOK_HANDLER_ERRORS",
        `${error_count} webhook event(s) errored in last 24h`,
        { error_count, types });
    }
  }
}

async function probePoolAErrorRate() {
  const eventsPath = path.join(STATE_DIR, "state", "t2-events.jsonl");
  let raw;
  try { raw = await fs.readFile(eventsPath, "utf8"); }
  catch {
    record("INFO", "POOL_A.NO_EVENTS", "t2-events.jsonl absent");
    return;
  }
  const cutoff = Date.now() - 60 * 60 * 1000; // last 60 min
  const lines = raw.split("\n").filter(Boolean);
  let total = 0, errors = 0;
  for (const line of lines) {
    try {
      const e = JSON.parse(line);
      const ts = e.ended_ms ?? Date.parse(e.ts_iso ?? "") ?? 0;
      if (ts < cutoff) continue;
      total++;
      if (e.exit_code && e.exit_code !== 0) errors++;
    } catch { /* skip malformed */ }
  }
  if (total === 0) {
    record("INFO", "POOL_A.IDLE", "No T2 events in last 60min");
    return;
  }
  const errPct = (errors / total) * 100;
  if (errPct >= T2_ERROR_THRESHOLD_PCT) {
    record("WARN", "POOL_A.HIGH_ERROR_RATE",
      `${errPct.toFixed(1)}% of last-hour T2 events errored (${errors}/${total})`,
      { error_pct: errPct, errors, total });
  } else {
    record("INFO", "POOL_A.HEALTHY",
      `${errPct.toFixed(1)}% error rate (${errors}/${total})`);
  }
}

async function probeHubInferenceFreshness() {
  // Inference-status JSON is heartbeat-updated. >5min stale → hub may be wedged.
  const p = path.join(STATE_DIR, "state", "inference-current.json");
  try {
    const stat = await fs.stat(p);
    const ageMin = (Date.now() - stat.mtimeMs) / 60000;
    if (ageMin > 30) {
      record("WARN", "HUB.INFERENCE_STALE",
        `inference-current.json is ${ageMin.toFixed(0)}min stale`,
        { age_min: ageMin });
    } else {
      record("INFO", "HUB.INFERENCE_FRESH",
        `inference-current.json ${ageMin.toFixed(0)}min old`);
    }
  } catch {
    record("INFO", "HUB.NO_INFERENCE_FILE",
      "No inference-current.json — hub may be idle or unconfigured");
  }
}

async function probeCatalogHires() {
  if (!SB_URL || !SB_KEY) return;
  const r = await callOpsRpc("wavex_os_ops_catalog_hire_counts");
  if (!r.ok) {
    record("WARN", "CATALOG.PROBE_FAILED",
      `RPC failed: ${r.status ?? r.reason} ${r.text ?? ""}`);
    return;
  }
  const stale = r.data
    .filter((a) => (a.active_hires ?? 0) === 0)
    .map((a) => `${a.catalog_id} (${a.display_name})`);
  if (stale.length) {
    record("INFO", "CATALOG.NO_HIRES",
      `${stale.length} catalog agents have zero active hires`,
      { agents: stale });
  } else {
    record("INFO", "CATALOG.ALL_HIRED",
      `${r.data.length} catalog agents all have ≥1 active hire`);
  }
}

// Phase 2 — paid-fleet sweep. Reads the latest instance_health per device
// (via wavex_os_ops_fleet_health) and opens covered incidents. A PAID fleet
// (pool_b + active/trialing sub) that is down or dark is CRIT — the
// redundancy promise. Matched playbooks ride along on the escalation.
async function probePaidFleetHealth() {
  if (!SB_URL || !SB_KEY) {
    record("INFO", "FLEET.SKIPPED", "Supabase creds not configured");
    return;
  }
  const r = await callOpsRpc("wavex_os_ops_fleet_health");
  if (!r.ok) {
    record("WARN", "FLEET.PROBE_FAILED",
      `RPC failed: ${r.status ?? r.reason} ${r.text ?? ""}`);
    return;
  }
  const rows = Array.isArray(r.data) ? r.data : [];
  if (rows.length === 0) {
    record("INFO", "FLEET.NONE_REPORTING",
      "No instance_health rows yet — no Liaison has pushed health");
    return;
  }

  let paid = 0, healthy = 0, incidents = 0;
  for (const row of rows) {
    const isPaid = row.tier === "pool_b" &&
      ["active", "trialing"].includes(row.subscription_status ?? "");
    if (isPaid) paid++;

    const stale = Number(row.staleness_minutes ?? 0) > FLEET_DARK_MINUTES;
    const down = row.fleet_status === "down";
    const degraded = row.fleet_status === "degraded" ||
      Number(row.agents_error ?? 0) > 0;

    // Match remediation playbooks against this fleet's recent_errors.
    const matched = matchPlaybooks(row);
    const playbook = matched[0]
      ? { id: matched[0].id, name: matched[0].name, remediation: matched[0].remediation }
      : null;

    const who = row.device_name || row.hostname || row.device_id;
    const detail = {
      device_id: row.device_id,
      subscription_id: row.subscription_id,
      tier: row.tier,
      paid: isPaid,
      fleet_status: row.fleet_status,
      staleness_minutes: row.staleness_minutes,
      agents_error: row.agents_error,
      ...(playbook ? { playbook } : {}),
    };

    if (stale) {
      // Liaison stopped pushing — we've gone blind. Worse than a reported `down`.
      record(isPaid ? "CRIT" : "INFO", "FLEET.DARK",
        `${isPaid ? "PAID" : "free"} fleet "${who}" went dark — no health push in ${row.staleness_minutes}min`,
        detail);
      incidents++;
    } else if (down) {
      record(isPaid ? "CRIT" : "WARN", "FLEET.DOWN",
        `${isPaid ? "PAID" : "free"} fleet "${who}" is DOWN${playbook ? ` — playbook ${playbook.id} matches` : ""}`,
        detail);
      incidents++;
    } else if (degraded) {
      record(isPaid ? "WARN" : "INFO", "FLEET.DEGRADED",
        `${isPaid ? "PAID" : "free"} fleet "${who}" degraded — ${row.agents_error} agent(s) erroring${playbook ? ` — playbook ${playbook.id} matches` : ""}`,
        detail);
      incidents++;
    } else {
      healthy++;
    }
  }

  record("INFO", "FLEET.SWEEP_DONE",
    `Swept ${rows.length} fleet(s): ${paid} paid, ${healthy} healthy, ${incidents} with incidents`);
}

// ────────────────────────────────────────────────────────────────────────────
// Main

async function main() {
  await Promise.all([
    probeManifestHealth(),
    probeStripeWebhookArrival(),
    probePoolAErrorRate(),
    probeHubInferenceFreshness(),
    probeCatalogHires(),
    probePaidFleetHealth(),
  ]);

  const result = await flush();

  // Notify on CRIT only
  const crits = findings.filter((f) => f.severity === "CRIT");
  if (crits.length > 0) {
    // Surface any matched remediation playbook inline — the operator (or the
    // WaveX Ops fleet) gets the concrete fix attached to the alert, not just
    // the symptom.
    const critLines = crits.flatMap((f) => {
      const lines = [`• \`${f.code}\` — ${f.summary}`];
      const pb = f.detail?.playbook;
      if (pb?.remediation) {
        lines.push(`  ↳ *playbook ${pb.id}* — ${pb.remediation.summary}`);
        for (const step of pb.remediation.steps ?? []) {
          lines.push(`     · ${step}`);
        }
        if (pb.remediation.docs) lines.push(`     · see ${pb.remediation.docs}`);
      }
      return lines;
    });
    const msg = [
      `*WaveX Ops — ${crits.length} critical finding${crits.length > 1 ? "s" : ""}*`,
      `_cycle ${cycleId}_`,
      "",
      ...critLines,
    ].join("\n");
    const tg = await notifyTelegram(msg);
    const pc = await notifyPaperclip(
      `WaveX Ops alert — ${crits.length} critical`,
      msg + "\n\nFull cycle: see ~/.wavex-os/state/ops-events.jsonl",
    );
    await fs.appendFile(
      LOG_FILE,
      `[${new Date().toISOString()}] CRIT-notify telegram=${JSON.stringify(tg)} paperclip=${JSON.stringify(pc)}\n`,
    );
  }

  // One-line summary to stdout for launchd capture
  const sevMax = Object.entries({ INFO: 0, WARN: 1, CRIT: 2 })
    .find(([, w]) => w === result.severity_max)?.[0] ?? "INFO";
  console.log(
    `[wavex-ops] cycle=${cycleId} sev_max=${sevMax} findings=${result.findings_count}`,
  );
}

main().catch((err) => {
  // Never throw out — write the failure and exit 0 so launchd keeps schedule
  const line = JSON.stringify({
    ts_iso: new Date().toISOString(),
    cycle_id: cycleId,
    fatal: String(err),
    stack: err?.stack,
  });
  fs.appendFile(EVENTS_FILE, line + "\n").catch(() => {});
  console.error(`[wavex-ops] fatal: ${err}`);
  process.exit(0);
});
