/** End-to-end smoke for the Avatar branch under ?t0=1 fast mode.
 *  Drives: gateway → profile → tools (connect 2) → voice (3 samples)
 *  → suggestions → finalize → /avatar/:id dashboard. */

import { chromium } from "@playwright/test";

const BASE = "http://127.0.0.1:5173";

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));

  await page.goto(`${BASE}/onboarding-chat?t0=1`);
  await page.waitForLoadState("networkidle");

  // Pick Avatar at the gateway
  await page.locator("button").filter({ hasText: /Set up my avatar/i }).first().click();
  console.log("✓ Picked Avatar");

  // Step 1: profile
  await page.waitForSelector("text=/Avatar setup · Step 1 of 4/i", { timeout: 5_000 });
  await page.locator("input[placeholder='Alex Founder']").fill("Test Operator");
  await page.locator("input[placeholder*='Indie hacker']").fill("Indie hacker");
  await page.locator("button").filter({ hasText: /^Continue/i }).click();
  console.log("✓ Profile saved");

  // Step 2: tools — connect 2
  await page.waitForSelector("text=/Avatar setup · Step 2 of 4/i", { timeout: 10_000 });
  await page.locator("button").filter({ hasText: /^Connect$/i }).first().click();
  await page.waitForFunction(
    () => document.body.textContent?.match(/1 of 8 connected/),
    undefined, { timeout: 5_000 },
  );
  await page.locator("button").filter({ hasText: /^Connect$/i }).first().click();
  await page.waitForFunction(
    () => document.body.textContent?.match(/2 of 8 connected/),
    undefined, { timeout: 5_000 },
  );
  console.log("✓ Connected 2 tools");
  await page.locator("button").filter({ hasText: /Continue →/i }).first().click();

  // Step 3: voice — paste 3 long samples
  await page.waitForSelector("text=/Avatar setup · Step 3 of 4/i", { timeout: 5_000 });
  const longSample = "This is a sample of how I write to colleagues with enough characters to clear the validation.";
  const textareas = page.locator("textarea");
  await textareas.nth(0).fill(longSample);
  await textareas.nth(1).fill(longSample.replace("colleagues", "myself in notes"));
  await textareas.nth(2).fill("Scheduling, follow-ups, drafting reusable copy — the time-sucky stuff.");
  await page.locator("button").filter({ hasText: /Continue →/i }).first().click();
  console.log("✓ Voice samples submitted");

  // Step 4: suggestions — finalize without enabling
  await page.waitForSelector("text=/Avatar setup · Step 4 of 4/i", { timeout: 30_000 });
  // Wait for suggestions to load (or empty state)
  await page.waitForFunction(
    () => /Launch — /i.test(document.body.textContent ?? ""),
    undefined, { timeout: 10_000 },
  );
  await page.locator("button").filter({ hasText: /Launch — /i }).first().click();
  console.log("✓ Finalized");

  // Land on /avatar/:id
  await page.waitForURL(/\/avatar\//, { timeout: 10_000 });
  console.log(`✓ Landed on dashboard: ${page.url()}`);

  // Confirm core panels render
  await page.waitForSelector("text=/Connected tools/i", { timeout: 5_000 });
  await page.waitForSelector("text=/Voice profile/i", { timeout: 5_000 });
  await page.waitForSelector("text=/Active automations/i", { timeout: 5_000 });
  console.log("✓ Dashboard sections render");

  if (errors.length) {
    console.log("⚠ console errors:");
    for (const e of errors) console.log("  ", e);
  }
  console.log("\n✓ Avatar flow smoke passed");
  await browser.close();
}

main().catch((e) => {
  console.error("\n✗ Smoke failed:", e.message);
  process.exit(1);
});
