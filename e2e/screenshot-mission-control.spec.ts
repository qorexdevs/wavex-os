/** Capture just the Mission Control dashboard, since onboarding's finalize
 *  step is environment-fragile. We seed via the dashboard.spec pattern and
 *  navigate to /?companyId=... once the company is finalized. */

import { test, expect, request as pwRequest } from "@playwright/test";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname_local = dirname(fileURLToPath(import.meta.url));
const SHOT_DIR = join(__dirname_local, "..", "docs", "images", "wizard");
const COMPANY_ID = `mc-shot-${Date.now().toString(36)}`;

test("seed + screenshot Mission Control", async ({ page }) => {
  const r = await pwRequest.newContext({ baseURL: "http://127.0.0.1:3101" });
  async function post(path: string, body: unknown): Promise<void> {
    const resp = await r.post(path, { data: body });
    if (!resp.ok()) {
      throw new Error(`POST ${path} failed: ${resp.status()} ${await resp.text()}`);
    }
  }
  await post("/op-omega/onboarding/pillar/1", {
    companyId: COMPANY_ID,
    org_name: "Acme",
    raw_input: "https://acme.example",
    manual_context: "Acme is a B2B SaaS for workflow automation. Mid-market, monthly subscription, assisted demo.",
  });
  await post("/op-omega/onboarding/pillar/2", { companyId: COMPANY_ID, claude_plan: "max_5x" });
  await post("/op-omega/onboarding/pillar/3", { companyId: COMPANY_ID, product_state: "live_paying_customers", stage: "10k_100k_mrr" });
  await post("/op-omega/onboarding/pillar/4", { companyId: COMPANY_ID, lead_sources: ["outbound_cold"], sales_motion: "assisted_demo", close_channel: "mostly_phone_video" });
  await post("/op-omega/onboarding/pillar/5", { companyId: COMPANY_ID, comm_channel: "telegram", urgency_routing: "all_to_one_channel" });
  await post("/op-omega/onboarding/connector-manifest", { companyId: COMPANY_ID, skipInference: true });
  await post("/op-omega/onboarding/swarm-manifest", { companyId: COMPANY_ID, skipInference: true });
  await post("/op-omega/onboarding/workflow-manifest", { companyId: COMPANY_ID, skipInference: true, bypassBudgetCheck: true });
  await post("/op-omega/onboarding/finalize", {
    companyId: COMPANY_ID, orgId: COMPANY_ID, skipInference: true,
    mc: { horizon_cycles: 5, n_runs: 5, seed: 42 },
  });
  // Activate so Mission Control has data
  await post(`/api/instance/${COMPANY_ID}/activate`, {});
  await r.dispose();

  await page.goto(`/?companyId=${COMPANY_ID}`);
  await page.waitForTimeout(3000);
  await page.screenshot({
    path: join(SHOT_DIR, "13-mission-control.png"),
    fullPage: true,
    animations: "disabled",
  });
});
