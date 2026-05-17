/** Debug-only spec: seed a finalized company, navigate to Phase 3 Swarm,
 *  screenshot the org chart, and dump node positions so we can see exactly
 *  what the layout is producing. Not part of the regular suite. */

import { test, expect, request as pwRequest } from "@playwright/test";

const API = "http://127.0.0.1:3101";
const COMPANY = `dbg-org-${Date.now().toString(36)}`;

test("debug: capture Phase 3 org chart layout", async ({ page }) => {
  test.skip(process.env.WAVEX_E2E_DEBUG !== "1", "Debug spec — set WAVEX_E2E_DEBUG=1 to run");
  test.setTimeout(120_000);

  // Seed pillars 1-2 (need pillar 1 + pillar 2 done so swarm-manifest will
  // accept). Use long manual_context to satisfy the 40-char min.
  const api = await pwRequest.newContext({ baseURL: API });
  async function post(path: string, body: unknown): Promise<void> {
    const r = await api.post(path, { data: body });
    if (!r.ok()) throw new Error(`POST ${path}: ${r.status()} ${await r.text()}`);
  }
  await post("/wavex-os/onboarding/pillar/1", {
    companyId: COMPANY, org_name: COMPANY,
    raw_input: "no product yet",
    manual_context: "Debug fixture for org chart layout — exercising the Phase 3 swarm visualization.",
  });
  await post("/wavex-os/onboarding/pillar/2", { companyId: COMPANY, claude_plan: "max_5x" });
  await post("/wavex-os/onboarding/pillar/3", { companyId: COMPANY, product_state: "live_paying_customers", stage: "10k_100k_mrr" });
  await post("/wavex-os/onboarding/pillar/4", { companyId: COMPANY, lead_sources: ["outbound_cold"], sales_motion: "assisted_demo", close_channel: "mostly_phone_video" });
  await post("/wavex-os/onboarding/pillar/5", { companyId: COMPANY, comm_channel: "telegram", urgency_routing: "all_to_one_channel" });
  await post("/wavex-os/onboarding/connector-manifest", { companyId: COMPANY, skipInference: true });
  await post("/wavex-os/onboarding/swarm-manifest", { companyId: COMPANY, skipInference: true });
  await api.dispose();

  // The wizard auto-routes to the first incomplete phase. After pillars +
  // connector + swarm exist (but not workflow + finalize), it should land on
  // Credentials / Concierge. Force the swarm view via internal navigation
  // by going through the phase nav once we're in.
  await page.goto(`/onboarding?companyId=${COMPANY}&t0=1`);

  // Click "Swarm" in the phase nav header
  await page.getByRole("button", { name: /^Swarm$/ }).click();
  await expect(page.getByRole("heading", { name: /Phase 3.*Swarm/i })).toBeVisible({ timeout: 30_000 });

  // Wait for the org chart to render
  await expect(page.locator(".react-flow__node").first()).toBeVisible({ timeout: 30_000 });
  await page.waitForTimeout(1500); // let fitView settle

  // Dump every node's slot + position
  const nodeData = await page.locator(".react-flow__node").evaluateAll((els) => {
    return els.map((el) => {
      const transform = (el as HTMLElement).style.transform || "";
      const match = transform.match(/translate\((-?[\d.]+)px,\s*(-?[\d.]+)px\)/);
      return {
        id: el.getAttribute("data-id"),
        text: (el.textContent || "").trim().slice(0, 60),
        x: match ? parseFloat(match[1]) : null,
        y: match ? parseFloat(match[2]) : null,
      };
    });
  });

  // Also capture each node's RENDERED screen bounding box (post-viewport-transform)
  const screenBoxes = await page.locator(".react-flow__node").evaluateAll((els) => {
    return els.map((el) => {
      const r = (el as HTMLElement).getBoundingClientRect();
      return {
        id: el.getAttribute("data-id"),
        sx: Math.round(r.x),
        sy: Math.round(r.y),
        sw: Math.round(r.width),
        sh: Math.round(r.height),
      };
    });
  });

  const containerBox = await page.locator(".react-flow").evaluate((el) => {
    const r = (el as HTMLElement).getBoundingClientRect();
    return { cx: Math.round(r.x), cy: Math.round(r.y), cw: Math.round(r.width), ch: Math.round(r.height) };
  });
  console.log(`\nContainer bbox: ${JSON.stringify(containerBox)}`);

  // Sort by y then x for readability
  nodeData.sort((a, b) => (a.y ?? 0) - (b.y ?? 0) || (a.x ?? 0) - (b.x ?? 0));
  console.log(`\n=== Phase 3 Org Chart — ${nodeData.length} nodes ===`);
  for (const n of nodeData) {
    const sb = screenBoxes.find((b) => b.id === n.id);
    console.log(`  layout(${(n.x ?? 0).toFixed(0).padStart(5)},${(n.y ?? 0).toFixed(0).padStart(5)})  screen(${sb?.sx},${sb?.sy} ${sb?.sw}x${sb?.sh})  ${n.id?.padEnd(22)} ${n.text}`);
  }

  // Find all CSS rules that target .react-flow__node and report each rule's
  // selector + position property.
  const cssRules = await page.evaluate(() => {
    const matches: Array<{ source: string; selector: string; position?: string; rest?: string }> = [];
    for (const sheet of Array.from(document.styleSheets)) {
      let rules: CSSRuleList;
      try { rules = sheet.cssRules; } catch { continue; }
      for (const rule of Array.from(rules)) {
        if (!(rule instanceof CSSStyleRule)) continue;
        if (rule.selectorText.includes(".react-flow__node") || rule.selectorText.includes(".react-flow .react-flow__node")) {
          matches.push({
            source: sheet.href ?? "(inline)",
            selector: rule.selectorText,
            position: rule.style.position,
            rest: rule.style.cssText.slice(0, 120),
          });
        }
      }
    }
    return matches.slice(0, 20);
  });
  console.log(`\nCSS rules matching .react-flow__node:\n${JSON.stringify(cssRules, null, 2)}`);

  // Take a wider screenshot of whole page so the chart container is fully framed
  await page.setViewportSize({ width: 1600, height: 1000 });
  await page.waitForTimeout(500);
  await page.locator(".react-flow").screenshot({ path: "test-results/_debug-orgchart.png" });
  console.log("\nScreenshot: test-results/_debug-orgchart.png");
});
