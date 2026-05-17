/** Headed demo — drives the wizard to the Materialize phase via API, then
 *  opens the browser at the activation step so you can watch + click
 *  Activate yourself. Reports Paperclip handoff status to console.
 *
 *  Run: pnpm exec playwright test e2e/_demo-handoff.spec.ts --headed
 *
 *  The browser stays open after the test runs — the test ends with an
 *  infinite wait so you can inspect Mission Control, the Paperclip status,
 *  network calls, etc. Hit Ctrl+C to exit. */

import { test, expect } from "@playwright/test";

const API = "http://127.0.0.1:3101";

test("end-to-end wizard → activate → Paperclip handoff visibility", async ({ page, request }, testInfo) => {
  // Allow this test to run for up to 4 hours — it ends in an infinite wait
  // so the operator can inspect the running browser without timeout pressure.
  testInfo.setTimeout(4 * 60 * 60 * 1000);

  const id = `demo-${Date.now().toString(36)}`;
  const orgName = "DemoCo";

  console.log("\n=================================================");
  console.log(`[demo] companyId: ${id}`);
  console.log(`[demo] PAPERCLIP_HANDOFF_URL: ${process.env.PAPERCLIP_HANDOFF_URL ?? "(unset → handoff will be no-op)"}`);
  console.log("=================================================\n");

  // ── 1. Seed pillars 1-5 via API (fast, no T2) ──────────────────────────
  async function post(path: string, body: unknown) {
    const r = await request.post(`${API}${path}`, { data: body });
    if (!r.ok()) throw new Error(`POST ${path}: ${r.status()} ${await r.text()}`);
    return r.json();
  }

  console.log("[demo] seeding pillar responses…");
  await post("/wavex-os/onboarding/pillar/1", {
    companyId: id, org_name: orgName, raw_input: "no product yet",
    manual_context: "DemoCo is an end-to-end fixture for verifying that the wizard's activate step correctly reports the Paperclip handoff result to the operator.",
  });
  await post("/wavex-os/onboarding/pillar/2", { companyId: id, claude_plan: "max_5x" });
  await post("/wavex-os/onboarding/pillar/3", { companyId: id, product_state: "live_paying_customers", stage: "10k_100k_mrr" });
  await post("/wavex-os/onboarding/pillar/4", { companyId: id, lead_sources: ["outbound_cold"], sales_motion: "assisted_demo", close_channel: "mostly_phone_video" });
  await post("/wavex-os/onboarding/pillar/5", { companyId: id, comm_channel: "telegram", urgency_routing: "all_to_one_channel" });

  console.log("[demo] generating connector / swarm / workflow manifests…");
  await post("/wavex-os/onboarding/connector-manifest", { companyId: id, skipInference: true });
  await post("/wavex-os/onboarding/swarm-manifest", { companyId: id, skipInference: true });
  await post("/wavex-os/onboarding/workflow-manifest", { companyId: id, skipInference: true, bypassBudgetCheck: true });

  // ── 2. Open browser at /onboarding?phase=materialize ──────────────────
  // The Materialize UI shows the Finalize button; we navigate AFTER seed
  // so the operator sees the post-finalize state (or pre-finalize, depending
  // on whether they want to walk that step too).
  await page.setViewportSize({ width: 1700, height: 1100 });
  await page.goto(`/onboarding?companyId=${id}&phase=materialize`);
  await expect(page.getByRole("heading").first()).toBeVisible({ timeout: 10_000 });

  console.log("[demo] browser is open at the Materialize phase.");
  console.log("[demo] Step 1: click 'Finalize' to sign the manifest.");
  console.log("[demo] Step 2: click 'Activate fleet →' to push to the DB + Paperclip.");
  console.log("[demo] Watch the network tab for POST /api/instance/.../activate — its response includes 'paperclipHandoff'.\n");

  // ── 3. Intercept the activate response to log handoff status ──────────
  page.on("response", async (resp) => {
    if (resp.url().includes("/activate") && resp.request().method() === "POST") {
      try {
        const body = await resp.json();
        console.log("\n========== ACTIVATE RESPONSE ==========");
        console.log(`  ok:                    ${body.ok}`);
        console.log(`  inserted.companies:    ${body.inserted?.companies}`);
        console.log(`  inserted.agents:       ${body.inserted?.agents}`);
        console.log(`  paperclipHandoff:      ${JSON.stringify(body.paperclipHandoff, null, 2)}`);
        console.log("=======================================\n");

        const h = body.paperclipHandoff;
        if (!h?.enabled) {
          console.log("[demo] ⚠ Paperclip handoff is DISABLED.");
          console.log("[demo]    Reason: PAPERCLIP_HANDOFF_URL env var is unset.");
          console.log("[demo]    To enable: export PAPERCLIP_HANDOFF_URL=http://localhost:<paperclip-port>");
          console.log("[demo]    Then re-run the activate step and the C-Suite will mirror to Paperclip.\n");
        } else if ((h.errors ?? []).length > 0) {
          console.log("[demo] ⚠ Paperclip handoff REACHED but had errors:");
          for (const e of h.errors) console.log(`[demo]   - ${e.slot}: ${e.message}`);
        } else {
          console.log(`[demo] ✓ Paperclip handoff succeeded — ${h.created?.length ?? 0} agents created in Paperclip at ${h.paperclipUrl}\n`);
        }
      } catch (e) {
        console.log("[demo] (could not parse activate response)", e);
      }
    }
  });

  // ── 4. Pause indefinitely so browser stays open ────────────────────────
  console.log("[demo] Browser will stay open. Hit Ctrl+C in this terminal to exit.\n");
  await new Promise(() => { /* never resolves */ });
});
