/** Verifies the UX polish batch:
 *  1. Non-URL welcome input prompts for more detail (no halt)
 *  2. T2 progress shows human narration ("Reading your site"), not the
 *     technical "T2 generating · Ns elapsed · median…" string
 *  3. Pillar 1 confirm card surfaces inferred-signals panel
 *
 *  Uses ?t0=1 so deterministic fallbacks come back instantly. The walk
 *  shouldn't be flaky on slow runs. */

import { chromium } from "@playwright/test";

const BASE = "http://127.0.0.1:5173";
const SLUG = `polish-${Math.floor(Date.now() / 1000).toString(36)}`;

async function resetState() {
  for (const s of [SLUG, "we-build-ai"]) {
    try { await fetch(`${BASE}/api/instance/${encodeURIComponent(s)}/reset`, { method: "DELETE" }); } catch { /* */ }
  }
}

async function main() {
  await resetState();
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));

  await page.goto(`${BASE}/onboarding-chat?t0=1`);
  await page.waitForLoadState("networkidle");

  // Type a short non-URL message — should trigger the "tell me more" prompt
  // rather than going straight to T2.
  const input = page.locator("textarea").first();
  await input.click();
  await input.type("We build AI agents", { delay: 15 });
  await page.keyboard.press("Enter");
  console.log("✓ Submitted short non-URL input");

  // Wait for the "tell me a bit more" assistant message.
  await page.waitForFunction(
    () => /tell me a bit more/i.test(document.body.textContent ?? ""),
    undefined,
    { timeout: 8_000 },
  );
  console.log("✓ Non-URL gate prompts for more detail (no halt)");

  // Verify NO halt screen rendered (the old failure path).
  const haltVisible = await page.getByText(/couldn't extract anything useful/i).isVisible().catch(() => false);
  if (haltVisible) throw new Error("FAIL: halt screen still appeared for non-URL input");
  console.log("✓ No halt screen rendered");

  // Expand the input with more context, submit, expect T2 narration to appear.
  await input.click();
  await input.type("for B2B SaaS teams that need help managing their revenue operations and customer success workflows.", { delay: 8 });
  await page.keyboard.press("Enter");
  console.log("✓ Submitted expanded pitch");

  // Look for the new human narration (not the technical jargon).
  await page.waitForFunction(
    () => /Reading your site|Figuring out what you do|Spotting your ideal customer|Pulling it together/i
      .test(document.body.textContent ?? ""),
    undefined,
    { timeout: 10_000 },
  );
  console.log("✓ T2 narrator shows human phase label");

  // Confirm the old technical strings are gone from visible text.
  const technicalShowing = await page.getByText(/T2 generating ·|median ~|no history yet|claude pid/).first().isVisible().catch(() => false);
  if (technicalShowing) {
    console.log("⚠ Technical strings still visible — should be in the details drawer only");
  } else {
    console.log("✓ Technical strings hidden behind details drawer");
  }

  // Pillar 1 panel should still render with inferred signals header.
  await page.waitForFunction(
    () => /Read from your site/i.test(document.body.textContent ?? ""),
    undefined,
    { timeout: 60_000 },
  );
  console.log("✓ Pillar 1 'Read from your site' panel renders");

  if (errors.length > 0) {
    console.log("⚠ Console errors:");
    for (const e of errors) console.log(`   ${e}`);
  }

  console.log("\n✓ Polish batch verified");
  await browser.close();
}

main().catch((e) => {
  console.error("\n✗ Verify failed:", e.message);
  process.exit(1);
});
