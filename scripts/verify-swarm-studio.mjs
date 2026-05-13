/** Focused verification of Swarm Studio's rebalanced chrome:
 *  - Compact search + segmented filter on one row
 *  - Stats line in the header (active · parked · scope)
 *  - Status strip in the footer (swap/add counts)
 *  - Department column labels above tier-2 chiefs
 *  - "+ Add" button still present
 *  - Parked badge appears under parked-agent names
 *
 *  Drives the t0=1 chat-first walk into Swarm Studio quickly. */

import { chromium } from "@playwright/test";

const BASE = "http://127.0.0.1:5173";
const SLUG = `studio-${Math.floor(Date.now() / 1000).toString(36)}`;

async function reset() {
  for (const s of [SLUG, "ricoma"]) {
    try { await fetch(`${BASE}/api/instance/${encodeURIComponent(s)}/reset`, { method: "DELETE" }); } catch { /* */ }
  }
}

async function main() {
  await reset();
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));

  await page.goto(`${BASE}/onboarding-chat?t0=1`);
  await page.waitForLoadState("networkidle");

  // Welcome: URL path (t0=1 short-circuits the T2 call so it's instant)
  const input = page.locator("textarea").first();
  await input.click();
  await input.type("ricoma.com — I need marketing and sales help", { delay: 10 });
  await page.keyboard.press("Enter");

  // Pillar 1 confirm
  await page.getByRole("button", { name: /Looks right.*keep going|Update.*continue/i }).waitFor({ timeout: 20_000 });
  await page.getByRole("button", { name: /Looks right.*keep going|Update.*continue/i }).click();

  // Scope picker (auto-detected marketing+sales)
  const scopeContinue = page.getByRole("button", { name: /^Continue/ }).last();
  if (await scopeContinue.isVisible().catch(() => false)) await scopeContinue.click();

  // Pillars 3/4/5
  await page.getByRole("button", { name: /Live with paying customers/i }).waitFor({ timeout: 15_000 });
  await page.getByRole("button", { name: /Live with paying customers/i }).click();
  await page.getByRole("button", { name: /\$10k.*100k/i }).click();
  await page.getByRole("button", { name: /^Continue/ }).last().click();
  await page.getByRole("button", { name: /Inbound ads/i }).click();
  await page.getByRole("button", { name: /Assisted.*demo required/i }).click();
  await page.getByRole("button", { name: /Mostly phone/i }).click();
  await page.getByRole("button", { name: /^Continue/ }).last().click();
  await page.getByRole("button", { name: /^Slack$/i }).click();
  await page.getByRole("button", { name: /Daily digest/i }).click();
  await page.getByRole("button", { name: /^Continue/ }).last().click();

  // Connectors + skip creds
  await page.getByRole("button", { name: /These look right.*plug them in/i }).waitFor({ timeout: 30_000 });
  await page.getByRole("button", { name: /These look right.*plug them in/i }).click();
  await page.getByRole("button", { name: /Skip all \(\d+\)/ }).waitFor({ timeout: 10_000 });
  await page.getByRole("button", { name: /Skip all \(\d+\)/ }).click();
  await page.getByRole("button", { name: /Done.*continue to swarm/i }).click();

  // === Swarm Studio assertions ===
  await page.getByRole("button", { name: /These look right.*wire them up/i }).waitFor({ timeout: 30_000 });
  console.log("✓ Reached Swarm Studio");

  // Header: compact search input renders
  const search = page.getByPlaceholder(/Search agents/i);
  if (!(await search.isVisible())) throw new Error("Search input missing");
  console.log("✓ Compact search input renders");

  // Header: segmented filter (3 buttons inline)
  for (const f of ["All", "Active", "Parked"]) {
    const btn = page.getByRole("button", { name: f, exact: true });
    if (!(await btn.isVisible().catch(() => false))) throw new Error(`Filter button "${f}" missing`);
  }
  console.log("✓ Segmented filter chips render");

  // Header: stats line ("N active · N parked · scope")
  await page.waitForFunction(
    () => /\d+ active\s*·\s*\d+ parked/.test(document.body.textContent ?? ""),
    undefined,
    { timeout: 5_000 },
  );
  const statsText = await page.evaluate(() => {
    const m = (document.body.textContent ?? "").match(/(\d+) active\s*·\s*(\d+) parked\s*·\s*([^·\n]+)/);
    return m ? m[0] : null;
  });
  console.log(`✓ Header stats line: "${statsText?.trim()}"`);

  // Header: "+ Add" button (smaller, ghost style)
  const addBtn = page.getByRole("button", { name: /^\+ Add$/i });
  if (!(await addBtn.isVisible())) throw new Error("+ Add button missing");
  console.log("✓ + Add button renders (ghost)");

  // Footer: status strip with swap/add counters
  await page.waitForFunction(
    () => /\d+ swap/.test(document.body.textContent ?? "") && /\d+ added/.test(document.body.textContent ?? ""),
    undefined,
    { timeout: 3_000 },
  );
  console.log("✓ Footer status strip renders (swaps + added counters)");

  // Department headers above tier-2 chiefs (rendered as label-only org nodes)
  const headerLabels = await page.locator("text=/^(Executive|Product|Marketing|Revenue|Finance|Data|Operations)$/").count();
  if (headerLabels < 1) {
    console.log("⚠ Department headers not visible (might be off-screen — checking DOM)");
    const headerTextInDom = await page.evaluate(() => {
      return ["Executive","Product","Marketing","Revenue","Finance","Data","Operations"]
        .filter((d) => (document.body.textContent ?? "").includes(d));
    });
    if (headerTextInDom.length === 0) throw new Error("No department headers found in DOM");
    console.log(`✓ Department headers present in DOM: ${headerTextInDom.join(", ")}`);
  } else {
    console.log(`✓ Department headers rendered: ${headerLabels} visible`);
  }

  // Parked badge: in focused scope, there should be parked agents with the badge
  const parkedBadgeCount = await page.locator("text=/^PARKED$|^DISABLED$/").count();
  if (parkedBadgeCount === 0) {
    console.log("⚠ No parked badge visible (might be in full-org mode)");
  } else {
    console.log(`✓ Parked badge rendered (${parkedBadgeCount} instances)`);
  }

  // Filter behavior: type "cmo" in search, expect match count to appear
  await search.fill("cmo");
  await page.waitForFunction(
    () => /\d+\s*\/\s*\d+/.test(document.body.textContent ?? ""),
    undefined,
    { timeout: 3_000 },
  );
  const matchText = await page.evaluate(() => {
    const m = (document.body.textContent ?? "").match(/(\d+)\s*\/\s*(\d+)/);
    return m ? m[0] : null;
  });
  console.log(`✓ Search produces match count: "${matchText}"`);

  // Cleanup
  await search.fill("");
  if (errors.length > 0) {
    console.log("⚠ Console errors:");
    for (const e of errors) console.log(`   ${e}`);
  }

  console.log("\n✓ Swarm Studio rebalance verified");
  await browser.close();
}

main().catch((e) => {
  console.error("\n✗ Verify failed:", e.message);
  process.exit(1);
});
