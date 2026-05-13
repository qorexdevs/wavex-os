/** End-to-end smoke for the Avatar branch under ?t0=1 fast mode.
 *  Avatar onboarding now uses the same chat-thread + inline-card pattern
 *  as Solo/Hybrid (Phase 4). Each step drops a card into an assistant
 *  bubble; we drive selectors off the bubble text instead of the old
 *  "Step N of 5" full-screen badges. */

import { chromium } from "@playwright/test";

const BASE = "http://127.0.0.1:5173";

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  // Phase 7-B — pre-dismiss the coachmark walkthroughs so they don't
  // intercept the post-finalize "Dashboard sections render" assertion.
  await page.addInitScript(() => {
    localStorage.setItem("coachmark-avatar-v1", "1");
    localStorage.setItem("coachmark-mission-v1", "1");
  });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));

  await page.goto(`${BASE}/onboarding-chat?t0=1`);
  await page.waitForLoadState("networkidle");

  // Pick Avatar at the gateway
  await page.locator("button").filter({ hasText: /Set up my avatar/i }).first().click();
  console.log("✓ Picked Avatar");

  // Welcome hero: type a free-text intro. T2 parses → profile card pre-fills.
  await page.waitForSelector("text=/Let's get to know you/i", { timeout: 5_000 });
  await page.locator("textarea[placeholder*=\"I'm\"]").fill(
    "I'm Dylan, founder at WaveX. Work 9-5 EST. Hand off email triage first.",
  );
  await page.locator("button", { hasText: /^↑$/ }).first().click();
  console.log("✓ Welcome intro submitted");

  // Profile card lands inline; under t0=1 the stub fills name=Operator role=Founder.
  await page.waitForSelector("text=/Got it. Here's what I caught/i", { timeout: 10_000 });
  // Overwrite the parsed values with the smoke's test ones.
  await page.locator("input[placeholder='Alex Founder']").fill("Test Operator");
  await page.locator("input[placeholder*='Indie hacker']").fill("Indie hacker");
  await page.locator("button").filter({ hasText: /^Continue/i }).click();
  console.log("✓ Profile confirmed");

  // Step 2: tools — bubble announces, card follows. Connect 2 (Gmail first).
  await page.waitForSelector("text=/Pick the tools you live in/i", { timeout: 10_000 });
  await page.locator("button").filter({ hasText: /^Connect$/i }).first().click();
  await page.waitForFunction(
    () => document.body.textContent?.match(/1 of 8 connected/),
    undefined, { timeout: 5_000 },
  );
  // Gmail drawer auto-opens — skip it to keep the smoke fast (drawer
  // fields are exercised by direct backend smoke, not this UI walk).
  await page.locator("button").filter({ hasText: /^Skip$/ }).first().click();
  await page.locator("button").filter({ hasText: /^Connect$/i }).first().click();
  await page.waitForFunction(
    () => document.body.textContent?.match(/2 of 8 connected/),
    undefined, { timeout: 5_000 },
  );
  console.log("✓ Connected 2 tools + dismissed drawer");
  await page.locator("button").filter({ hasText: /Continue →/i }).first().click();

  // Step 3: voice — paste 3 long samples (signoff/guardrails optional)
  await page.waitForSelector("text=/Show me how you write/i", { timeout: 5_000 });
  const longSample = "This is a sample of how I write to colleagues with enough characters to clear the validation.";
  const textareas = page.locator("textarea");
  await textareas.nth(0).fill(longSample);
  await textareas.nth(1).fill(longSample.replace("colleagues", "myself in notes"));
  await textareas.nth(2).fill("Scheduling, follow-ups, drafting reusable copy — the time-sucky stuff.");
  await page.locator("button").filter({ hasText: /Continue →/i }).first().click();
  console.log("✓ Voice samples submitted");

  // Step 4: Trust & boundaries — keep defaults, click Continue
  await page.waitForSelector("text=/How autonomous on day one/i", { timeout: 10_000 });
  await page.waitForSelector("text=/Autonomy preset/i", { timeout: 5_000 });
  await page.locator("button").filter({ hasText: /Continue →/i }).first().click();
  console.log("✓ Trust step submitted (defaults)");

  // Step 5: suggestions — finalize without enabling
  await page.waitForSelector("text=/Pick what your avatar should start doing/i", { timeout: 30_000 });
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
