/** Live demo spec — full onboarding walk for a real company, headed in
 *  chromium, with real T2 enrichment so the matrix selection has signal.
 *  Pauses at the end on Mission Control so you can poke around.
 *
 *  Run:
 *    WAVEX_E2E_DEMO=1 pnpm test:e2e e2e/_demo-onboarding.spec.ts --headed --workers=1
 *
 *  Skipped by default to avoid eating CI time + claude tokens. */

import { test, expect, type Page } from "@playwright/test";

const RUN = process.env.WAVEX_E2E_DEMO === "1";

// Real .com — Linear is a modern B2B SaaS dev tool with a clear ICP.
// Should drive the matrix toward engineering-focused picks.
const COMPANY_ID = `demo-linear-${Date.now().toString(36)}`;
const COMPANY_NAME = "Linear";
const COMPANY_URL = "https://linear.app";
const COMPANY_CONTEXT = "Linear is a project management tool built for software teams. Modern, opinionated, fast. Sells via product-led growth + assisted demos for larger teams. Engineering-focused customer base (CTO/eng leaders are buyers).";

test.describe("Live demo — real company", () => {
  test.skip(!RUN, "Set WAVEX_E2E_DEMO=1 to run (requires claude CLI + auth, takes ~5-8 min)");

  test("Linear — full walk through real T2 enrichment", async ({ page }) => {
    test.setTimeout(20 * 60 * 1000);

    await page.goto("/onboarding");
    await expect(page.getByRole("heading", { name: /Onboarding/i }).first()).toBeVisible();

    // Welcome → fill name → Start
    const nameInput = page.locator("input[autofocus], input:not([type='radio']):not([type='checkbox'])").first();
    await nameInput.fill(COMPANY_NAME);
    await page.waitForTimeout(800);
    await page.getByRole("button", { name: /^Start/i }).click();
    await expect(page.getByRole("heading", { name: /Pillar 1.*who you are/i })).toBeVisible();

    // ---- Pillar 1 — REAL T2 enrichment via WebFetch on linear.app ----
    const inputs = page.locator("input[type='text'], input:not([type='radio']):not([type='checkbox']):not([type='password'])");
    await inputs.nth(0).fill(COMPANY_NAME);
    await page.waitForTimeout(400);
    await inputs.nth(1).fill(COMPANY_URL);
    await page.waitForTimeout(800);
    await page.getByRole("button", { name: /^Next/i }).click();

    // T2 deep-dive runs here — operator watches the real progress indicator
    // (elapsed seconds + claude pid). Up to 3 min for full multi-page synthesis.
    await expect(page.getByRole("heading", { name: /confirm what we inferred/i }))
      .toBeVisible({ timeout: 300_000 });

    // Pause briefly so the user can read the enrichment summary
    await page.waitForTimeout(4_000);
    await page.getByRole("button", { name: /Confirm \+ continue/i }).click();

    // ---- Pillar 2 — claude probe ----
    await expect(page.getByRole("heading", { name: /Verifying your setup/i })).toBeVisible();
    await page.waitForTimeout(1_500);
    await page.getByRole("button", { name: /Verify.*Continue/i }).click();
    await expect(page.getByRole("heading", { name: /Pillar 3/i })).toBeVisible({ timeout: 60_000 });

    // ---- Pillar 3 — accept defaults (live + 10k-100k MRR is the most common
    // shape; matches Linear's likely posture) ----
    await page.waitForTimeout(2_000);
    await page.getByRole("button", { name: /^Next/i }).click();
    await expect(page.getByRole("heading", { name: /Pillar 4/i })).toBeVisible();

    // ---- Pillar 4 — accept defaults ----
    await page.waitForTimeout(2_000);
    await page.getByRole("button", { name: /^Next/i }).click();
    await expect(page.getByRole("heading", { name: /Pillar 5/i })).toBeVisible();

    // ---- Pillar 5 — accept telegram default ----
    await page.waitForTimeout(2_000);
    await page.getByRole("button", { name: /Finish Phase 1/i }).click();
    await expect(page.getByRole("heading", { name: /Phase 2.*Connectors/i }))
      .toBeVisible({ timeout: 30_000 });

    // ---- Phase 2 — real T2 connector refinement ----
    const phase2Continue = page.getByRole("button", { name: /Continue.*swarm/i });
    await expect(phase2Continue).toBeEnabled({ timeout: 240_000 });
    await page.waitForTimeout(3_000); // let the operator see the connector list
    await phase2Continue.click();
    await expect(page.getByRole("heading", { name: /Credential Concierge/i })).toBeVisible({ timeout: 15_000 });

    // ---- Concierge — Skip all (we're demo, no real credentials) ----
    await page.waitForTimeout(2_000);
    const skipAll = page.getByRole("button", { name: /↷ Skip all/ });
    if (await skipAll.isVisible().catch(() => false)) {
      await skipAll.click();
      await page.getByRole("button", { name: /Skip all \d+ →/i }).click();
      await page.waitForTimeout(1_500);
    } else {
      // Fall back to per-card skip if Skip-all is missing
      let safety = 25;
      while (safety-- > 0) {
        const skipBtn = page.getByRole("button", { name: /^Skip$/ }).first();
        if (!(await skipBtn.isVisible().catch(() => false))) break;
        await skipBtn.click();
        await page.getByRole("button", { name: /Confirm skip/i }).first().click();
        await page.waitForTimeout(300);
      }
    }
    await page.getByRole("button", { name: /Continue.*swarm/i }).click();
    await expect(page.getByRole("heading", { name: /Phase 3.*Swarm/i })).toBeVisible({ timeout: 15_000 });

    // ---- Phase 3 — real T2 swarm refinement; org chart renders here ----
    const phase3Continue = page.getByRole("button", { name: /Continue.*workflows/i });
    await expect(phase3Continue).toBeEnabled({ timeout: 240_000 });
    await page.waitForTimeout(5_000); // let the operator see the org chart
    await phase3Continue.click();
    await expect(page.getByRole("heading", { name: /Phase 4.*Workflows/i })).toBeVisible({ timeout: 15_000 });

    // ---- Phase 4 — real T2 workflow patches ----
    const phase4Continue = page.getByRole("button", { name: /Continue.*finalize/i });
    await expect(phase4Continue).toBeEnabled({ timeout: 240_000 });
    await page.waitForTimeout(3_000);
    await phase4Continue.click();
    await expect(page.getByRole("heading", { name: /^Finalize$/i })).toBeVisible({ timeout: 15_000 });

    // ---- Finalize — real T2 imprint generation + Monte Carlo ----
    await page.waitForTimeout(2_000);
    await page.getByRole("button", { name: /Finalize.*sign/i }).click();
    await expect(page.getByText(/MATERIALIZED/i)).toBeVisible({ timeout: 240_000 });
    await page.waitForTimeout(4_000); // let the operator read the imprint

    // ---- Activate ----
    await page.getByRole("button", { name: /Activate fleet/i }).click();
    await expect(page.getByText(/Activated.*agents written to db/i)).toBeVisible({ timeout: 30_000 });

    // ---- Mission Control — leave operator here to explore ----
    await expect(page.getByRole("heading", { name: /KPI scoreboard/i })).toBeVisible({ timeout: 15_000 });

    // Pause for 90s so the user can poke around the dashboard, click agents,
    // open the swap panel, etc. before the test (and browser) closes.
    console.log(`\n[demo] ✓ Onboarding complete for ${COMPANY_NAME}`);
    console.log(`[demo] Mission Control loaded at http://127.0.0.1:5173/?companyId=${COMPANY_ID}`);
    console.log(`[demo] Browser will stay open for 90s — explore freely`);
    await page.waitForTimeout(90_000);
  });
});
