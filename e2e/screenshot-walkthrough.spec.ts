/** Playwright walkthrough that captures named screenshots of every wizard
 *  step + the final Mission Control. Run after a clean `pnpm dev` boot:
 *
 *     pnpm test:e2e e2e/screenshot-walkthrough.spec.ts
 *
 *  Output lands at docs/images/wizard/<NN-name>.png — used by README + the
 *  landing page. Mirrors onboarding.spec.ts but adds a screenshot per pillar.
 */

import { test, expect, type Page } from "@playwright/test";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname_local = dirname(fileURLToPath(import.meta.url));
const SHOT_DIR = join(__dirname_local, "..", "docs", "images", "wizard");
const COMPANY_NAME = `acme-${Date.now().toString(36)}`;

async function shot(page: Page, name: string): Promise<void> {
  await page.screenshot({
    path: join(SHOT_DIR, `${name}.png`),
    fullPage: true,
    animations: "disabled",
  });
}

test.describe("wizard walkthrough — capture screenshots", () => {
  test("welcome → 5 pillars → 3 phases → finalize → mission control", async ({ page }) => {
    test.slow();

    // Welcome
    await page.goto("/onboarding?t0=1");
    await expect(page.getByRole("heading", { name: /Onboarding/i }).first()).toBeVisible();
    await shot(page, "01-welcome");

    // Pillar 1 entry
    await page.locator("input[autofocus], input:not([type='radio']):not([type='checkbox'])").first().fill(COMPANY_NAME);
    await page.getByRole("button", { name: /^Start/i }).click();
    await expect(page.getByRole("heading", { name: /Pillar 1.*who you are/i })).toBeVisible();
    await shot(page, "02-pillar-1-who");

    // Pillar 1 — fill + advance to confirm screen
    const inputs = page.locator("input[type='text'], input:not([type='radio']):not([type='checkbox']):not([type='password'])");
    await inputs.nth(0).fill(COMPANY_NAME);
    await inputs.nth(1).fill("no product yet");
    await page.getByRole("button", { name: /^Next/i }).click();
    await expect(page.getByRole("heading", { name: /confirm what we inferred/i })).toBeVisible({ timeout: 60_000 });
    await shot(page, "03-pillar-1-confirm");
    await page.getByRole("button", { name: /Confirm \+ continue/i }).click();

    // Pillar 2
    await expect(page.getByRole("heading", { name: /Verifying your setup/i })).toBeVisible();
    await shot(page, "04-pillar-2-verify");

    if (process.env.WAVEX_E2E_SKIP_PILLAR2_VERIFY !== "1") {
      await page.getByRole("button", { name: /Verify.*Continue/i }).click();
      await expect(page.getByRole("heading", { name: /Pillar 3/i })).toBeVisible({ timeout: 60_000 });
    } else {
      // Stop here if we can't verify the Claude plan in this environment.
      return;
    }

    // Pillar 3
    await shot(page, "05-pillar-3-product-state");
    await page.getByRole("button", { name: /^Next/i }).click();
    await expect(page.getByRole("heading", { name: /Pillar 4/i })).toBeVisible();

    // Pillar 4
    await shot(page, "06-pillar-4-gtm");
    await page.getByRole("button", { name: /^Next/i }).click();
    await expect(page.getByRole("heading", { name: /Pillar 5/i })).toBeVisible();

    // Pillar 5
    await shot(page, "07-pillar-5-comms");
    await page.getByRole("button", { name: /Finish Phase 1/i }).click();
    await expect(page.getByRole("heading", { name: /Phase 2.*Connectors/i })).toBeVisible({ timeout: 30_000 });

    // Phase 2 — Connectors
    await expect(page.getByRole("heading", { name: /^Required$/i })).toBeVisible({ timeout: 15_000 });
    await shot(page, "08-phase-2-connectors");
    await page.getByRole("button", { name: /Continue.*swarm/i }).click();

    // Credential Concierge
    await expect(page.getByRole("heading", { name: /Credential Concierge/i })).toBeVisible({ timeout: 15_000 });
    await shot(page, "09-credential-concierge");

    // Skip all required connectors
    let safety = 20;
    while (safety-- > 0) {
      const skipBtn = page.getByRole("button", { name: /^Skip$/ }).first();
      if (!(await skipBtn.isVisible().catch(() => false))) break;
      await skipBtn.click();
      await page.getByRole("button", { name: /Confirm skip/i }).first().click();
      await page.waitForTimeout(300);
    }
    await page.getByRole("button", { name: /Continue.*swarm/i }).click();

    // Phase 3 — Swarm org chart
    await expect(page.getByRole("heading", { name: /Phase 3/i })).toBeVisible({ timeout: 30_000 });
    await page.waitForTimeout(2000); // let reactflow settle
    await shot(page, "10-phase-3-swarm");
    await page.getByRole("button", { name: /Continue.*workflow|Continue.*Phase 4/i }).first().click();

    // Phase 4 — Workflow
    await expect(page.getByRole("heading", { name: /Phase 4/i })).toBeVisible({ timeout: 30_000 });
    await shot(page, "11-phase-4-workflow");
    await page.getByRole("button", { name: /Continue.*finalize|Continue.*Phase 5/i }).first().click();

    // Finalize
    await expect(page.getByRole("heading", { name: /Finalize|Imprint|Monte Carlo/i })).toBeVisible({ timeout: 30_000 });
    await shot(page, "12-finalize");
    const finishBtn = page.getByRole("button", { name: /Finish|Activate|Complete/i }).first();
    if (await finishBtn.isVisible().catch(() => false)) {
      await finishBtn.click();
    }

    // Mission Control
    await page.goto("/");
    await page.waitForTimeout(2000);
    await shot(page, "13-mission-control");
  });
});
