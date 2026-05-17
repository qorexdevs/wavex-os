#!/usr/bin/env node
/** chat-smoke.mjs — walks every onboarding endpoint that the chat-first
 *  shell touches. Uses fast paths (manual_context on Pillar 1, skipInference
 *  on phases + finalize) so the whole walk completes in ~5-10s without real
 *  T2 cost. Use this to verify the backend wiring after pulling the branch
 *  or whenever something feels off in the UI.
 *
 *  Run: node scripts/chat-smoke.mjs [companyId] [baseUrl]
 *  Defaults: companyId=smoke-<unix>, baseUrl=http://127.0.0.1:5173 (Vite
 *  proxies /wavex-os and /api to mock-core on :3101). */

const baseUrl = process.argv[3] ?? process.env.WAVEX_SMOKE_BASE_URL ?? "http://127.0.0.1:5173";
const companyId = process.argv[2] ?? `smoke-${Math.floor(Date.now() / 1000).toString(36)}`;

const c = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  cyan: "\x1b[36m",
  gray: "\x1b[90m",
};

let stepNum = 0;
const results = [];

async function step(name, fn) {
  stepNum += 1;
  const t = Date.now();
  process.stdout.write(`${c.dim}[${String(stepNum).padStart(2, "0")}]${c.reset} ${name.padEnd(38)} `);
  try {
    const data = await fn();
    const ms = Date.now() - t;
    process.stdout.write(`${c.green}✓${c.reset} ${c.gray}${ms}ms${c.reset}\n`);
    results.push({ step: name, ok: true, ms, data });
    return data;
  } catch (e) {
    const ms = Date.now() - t;
    const msg = (e && e.message) || String(e);
    process.stdout.write(`${c.red}✗${c.reset} ${c.gray}${ms}ms${c.reset}  ${c.red}${msg.slice(0, 140)}${c.reset}\n`);
    results.push({ step: name, ok: false, ms, error: msg });
    return null;
  }
}

async function post(path, body) {
  const r = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const text = await r.text();
  let json;
  try { json = JSON.parse(text); } catch { json = { raw: text }; }
  if (!r.ok || json.ok === false) {
    throw new Error(`HTTP ${r.status}${json.error ? `: ${json.error}` : ""}${json.halt ? ` [halt: ${json.halt.code}]` : ""}`);
  }
  return json;
}

async function get(path) {
  const r = await fetch(`${baseUrl}${path}`);
  const text = await r.text();
  let json;
  try { json = JSON.parse(text); } catch { json = { raw: text }; }
  if (!r.ok || json.ok === false) {
    throw new Error(`HTTP ${r.status}${json.error ? `: ${json.error}` : ""}`);
  }
  return json;
}

async function del(path) {
  const r = await fetch(`${baseUrl}${path}`, { method: "DELETE" });
  if (r.status === 404) return null;
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return await r.json().catch(() => ({}));
}

async function main() {
  console.log("");
  console.log(`${c.bold}${c.cyan}chat-first onboarding smoke${c.reset}`);
  console.log(`${c.gray}  baseUrl   = ${baseUrl}${c.reset}`);
  console.log(`${c.gray}  companyId = ${companyId}${c.reset}`);
  console.log("");

  // Reset any prior state for this companyId so the smoke is idempotent.
  await step("reset (idempotent)", async () => {
    try { await del(`/api/instance/${encodeURIComponent(companyId)}/reset`); }
    catch { /* fresh slug — nothing to reset */ }
    return { ok: true };
  });

  // ── Pillar 1 fast path via manual_context (skips T2 enrichment) ────
  await step("POST /pillar/1 (manual_context)", () =>
    post("/wavex-os/onboarding/pillar/1", {
      companyId,
      org_name: companyId,
      raw_input: "ricoma.com",
      manual_context: "Ricoma is a commercial embroidery and apparel decoration equipment manufacturer selling B2B to print shops. They have an existing operations team and want AI to supplement marketing and sales — not replace customer support, which their staff handles in-house.",
    }));

  await step("POST /pillar/1/edit", () =>
    post("/wavex-os/onboarding/pillar/1/edit", {
      companyId,
      industry_hint: "dtc_ecommerce",
      business_model_hint: "subscription",
      has_product: true,
    }));

  // ── Pillar 2 verify probe (real claude check — fast but live) ──────
  await step("POST /pillar/2 (claude probe)", () =>
    post("/wavex-os/onboarding/pillar/2", {
      companyId,
      claude_plan: "max_20x",
    }));

  // ── Pillars 3-5 (deterministic) ────────────────────────────────────
  await step("POST /pillar/3", () =>
    post("/wavex-os/onboarding/pillar/3", {
      companyId,
      product_state: "live_paying_customers",
      stage: "10k_100k_mrr",
    }));

  await step("POST /pillar/4", () =>
    post("/wavex-os/onboarding/pillar/4", {
      companyId,
      lead_sources: ["inbound_ads_meta_google", "referral_word_of_mouth"],
      sales_motion: "assisted_demo",
      close_channel: "mostly_phone_video",
    }));

  await step("POST /pillar/5", () =>
    post("/wavex-os/onboarding/pillar/5", {
      companyId,
      comm_channel: "slack",
      urgency_routing: "digest_plus_urgent_phone",
    }));

  // ── Status hydration ───────────────────────────────────────────────
  await step("GET /onboarding/status", () =>
    get(`/wavex-os/onboarding/status?companyId=${encodeURIComponent(companyId)}`));

  // ── Sub-fleet scope (focused: marketing + revenue) ─────────────────
  await step("POST /scope (focused, marketing+revenue)", () =>
    post("/wavex-os/onboarding/scope", {
      companyId,
      mode: "focused",
      departments: ["marketing", "revenue"],
    }));

  await step("GET /scope", () =>
    get(`/wavex-os/onboarding/scope?companyId=${encodeURIComponent(companyId)}`));

  // ── Phase 2: connectors (skipInference=true for speed) ─────────────
  await step("POST /connector-manifest (T0 fast)", () =>
    post("/wavex-os/onboarding/connector-manifest", { companyId, skipInference: true }));

  await step("GET /credentials/:id", () =>
    get(`/wavex-os/onboarding/credentials/${encodeURIComponent(companyId)}`));

  // ── Phase 3: swarm (skipInference=true) ────────────────────────────
  await step("POST /swarm-manifest (T0 fast)", () =>
    post("/wavex-os/onboarding/swarm-manifest", { companyId, skipInference: true }));

  // ── Phase 4: workflows (skipInference=true) ────────────────────────
  await step("POST /workflow-manifest (T0 fast)", () =>
    post("/wavex-os/onboarding/workflow-manifest", { companyId, skipInference: true, bypassBudgetCheck: true }));

  // ── Finalize (skipInference=true skips imprint T2) ─────────────────
  await step("POST /finalize (T0 fast)", () =>
    post("/wavex-os/onboarding/finalize", { companyId, skipInference: true }));

  // ── Monte Carlo report (used by ImprintTheater Act 1) ──────────────
  await step("GET /mc-report", () =>
    get(`/wavex-os/onboarding/mc-report?companyId=${encodeURIComponent(companyId)}`));

  // ── Refinement loop (post-finalize T2 guidance) ────────────────────
  const analyze = await step("POST /analyze-refinement", () =>
    post("/wavex-os/onboarding/analyze-refinement", {
      companyId,
      operatorGuidance: "Emphasize international distribution and add observability for the dealer channel.",
    }));
  const changeIds = (analyze?.changes ?? []).slice(0, 2).map((c) => c.id);
  await step(`POST /apply-refinement (${changeIds.length} change(s))`, () =>
    post("/wavex-os/onboarding/apply-refinement", {
      companyId,
      operatorGuidance: "Emphasize international distribution and add observability for the dealer channel.",
      changes: (analyze?.changes ?? []).filter((c) => changeIds.includes(c.id)),
      regenerateImprint: false,
    }));
  await step("POST /revert-refinement", () =>
    post("/wavex-os/onboarding/revert-refinement", { companyId }));

  // ── Tiers + dummy subscription (Pricing) ───────────────────────────
  await step("GET /api/tiers", () => get("/api/tiers"));

  await step("POST /api/tier-subscriptions (skip)", () =>
    post("/api/tier-subscriptions", { orgId: companyId, tierId: "trial", origin: "skip" }));

  // ── Activate (writes signed manifest to runtime DB, fires handoff) ─
  await step("POST /api/instance/:id/activate", () =>
    post(`/api/instance/${encodeURIComponent(companyId)}/activate`, {}));

  // ── Mission Control reads ──────────────────────────────────────────
  await step("GET /api/companies", () => get("/api/companies"));
  await step("GET /api/instance/:id/manifest", () =>
    get(`/api/instance/${encodeURIComponent(companyId)}/manifest`));
  await step("GET /api/instance/:id/kpis", () =>
    get(`/api/instance/${encodeURIComponent(companyId)}/kpis`));

  // ── Cleanup ────────────────────────────────────────────────────────
  await step("DELETE /api/instance/:id/reset", () =>
    del(`/api/instance/${encodeURIComponent(companyId)}/reset`));

  // ── Summary ────────────────────────────────────────────────────────
  console.log("");
  const passed = results.filter((r) => r.ok).length;
  const failed = results.filter((r) => !r.ok);
  const totalMs = results.reduce((sum, r) => sum + r.ms, 0);
  if (failed.length === 0) {
    console.log(`${c.green}${c.bold}✓ ${passed}/${results.length} passed${c.reset}  ${c.gray}(${totalMs}ms total)${c.reset}`);

    // Fire test_run_completed activation event (best-effort, never blocks exit).
    // The server auto-derives user_activated if user_signed_up fired within 24h.
    void fetch(`${baseUrl}/api/activation-events/emit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        company_id: companyId,
        user_id: companyId,
        event_type: "test_run_completed",
        payload: { run_id: `smoke-${Date.now()}`, status: "success", duration_s: Math.round(totalMs / 1000), platform: "chat-smoke" },
      }),
    }).catch(() => {});

    process.exit(0);
  } else {
    console.log(`${c.red}${c.bold}✗ ${failed.length} failed${c.reset}, ${passed} passed  ${c.gray}(${totalMs}ms total)${c.reset}`);
    for (const f of failed) {
      console.log(`  ${c.red}✗${c.reset} ${f.step}: ${f.error}`);
    }
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(`${c.red}fatal:${c.reset}`, e);
  process.exit(2);
});
