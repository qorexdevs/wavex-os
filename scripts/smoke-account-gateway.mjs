import { chromium } from "@playwright/test";
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));

await page.goto("http://127.0.0.1:5173/onboarding-chat");
await page.waitForLoadState("networkidle");

// Hero text swaps to "Welcome to WaveX OS"
const heroText = await page.locator("h1").first().textContent();
console.log("hero h1:", heroText);
if (!/Welcome to WaveX OS/i.test(heroText ?? "")) throw new Error("gateway hero not visible");

// Three options present
const opts = await page.locator("button").filter({ hasText: /Avatar|Solo Founder|Hybrid/i }).count();
console.log("option buttons:", opts);
if (opts < 3) throw new Error("expected 3 option buttons");

// Avatar disabled (coming-next)
const avatarBtn = page.locator("button").filter({ hasText: /Set up my avatar/i }).first();
const avatarDisabled = await avatarBtn.evaluate((b) => b.disabled);
console.log("avatar disabled:", avatarDisabled);
if (!avatarDisabled) throw new Error("Avatar should be disabled in this slice");

// Pick Solo Founder → welcome textarea appears
await page.locator("button").filter({ hasText: /Build my full org/i }).first().click();
await page.waitForFunction(() => /What do you want to build/i.test(document.body.textContent ?? ""), undefined, { timeout: 3000 });
console.log("✓ Solo Founder routes to welcome textarea");

// Textarea present
const ta = await page.locator("textarea").first().isVisible();
if (!ta) throw new Error("textarea missing after Solo Founder click");

if (errors.length) {
  console.log("⚠ console errors:");
  for (const e of errors) console.log("  ", e);
}
console.log("✓ Account gateway smoke passed");
await browser.close();
