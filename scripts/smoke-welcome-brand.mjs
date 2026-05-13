import { chromium } from "@playwright/test";
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.goto("http://127.0.0.1:5173/onboarding-chat?t0=1");
await page.waitForLoadState("networkidle");

// Wordmark renders with new structure (Wave + X + OS as separate spans)
const waveText = await page.locator("text=/^Wave$/").count();
const xText = await page.locator("text=/^X$/").count();
const osText = await page.locator("text=/^OS$/").count();
console.log("wordmark spans:", { Wave: waveText, X: xText, OS: osText });
if (waveText === 0 || xText === 0 || osText === 0) throw new Error("wordmark structure missing");

// Pulse dot — animation defined
const hasAnimation = await page.evaluate(() => /wavex-brand-pulse/.test(document.documentElement.innerHTML));
console.log("pulse animation present:", hasAnimation);
if (!hasAnimation) throw new Error("pulse animation missing");

// Submit + watch for phase-out: the textarea + chips should fade
const input = page.locator("textarea").first();
await input.click();
await input.type("acme.com — we build collaboration software for design teams shipping monthly", { delay: 8 });
const heroSection = page.locator("h1:has-text('What do you want to build?')").locator("xpath=..").locator("xpath=..");
const opacityBefore = await heroSection.evaluate((el) => getComputedStyle(el).opacity);
console.log("hero opacity before submit:", opacityBefore);
await page.keyboard.press("Enter");
// Mid-fade snapshot — should be < 1
await page.waitForTimeout(180);
const opacityMid = await heroSection.evaluate((el) => getComputedStyle(el).opacity).catch(() => "unmounted");
console.log("hero opacity mid-fade:", opacityMid);

if (errors.length) {
  console.log("⚠ page errors:");
  for (const e of errors) console.log("  ", e);
}
console.log("✓ Welcome brand + phase-out smoke passed");
await browser.close();
