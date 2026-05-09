/** Playwright e2e — full onboarding wizard walk through the actual UI.
 *
 *  We use a single fixture (Acme — live B2B SaaS shape) and bypass T2 by
 *  filling in manual_context on Pillar 1. Pillar 2's claude probe runs
 *  against the local claude CLI (assumed installed for local + CI envs
 *  with a Max plan; tests are skipped if `WAVEX_E2E_SKIP_PILLAR2_VERIFY=1`).
 *
 *  Run with: pnpm test:e2e */

import { test, expect, type Page } from "@playwright/test";

const COMPANY_SLUG = `pw-acme-${Date.now().toString(36)}`;
const COMPANY_NAME = `pw-acme-${Date.now().toString(36)}`;
const MANUAL_CONTEXT = "Acme is a B2B SaaS platform for workflow automation, sold to mid-market ops teams via assisted demo. $1k-5k/mo subscription pricing.";

/** Walk pillar 1 form. Uses raw_input="no product yet" which the plugin's
 *  `looksLikeNoProduct` matcher short-circuits — no T2 round-trip, deterministic
 *  confirm screen appears immediately. (Live-SaaS-shape coverage is in the
 *  API-level e2e battery.) */
async function walkPillar1(page: Page): Promise<void> {
  await expect(page.getByRole("heading", { name: /Pillar 1.*who you are/i })).toBeVisible();

  const inputs = page.locator("input[type='text'], input:not([type='radio']):not([type='checkbox']):not([type='password'])");
  await inputs.nth(0).fill(COMPANY_NAME);
  await inputs.nth(1).fill("no product yet");

  await page.getByRole("button", { name: /^Next/i }).click();

  await expect(page.getByRole("heading", { name: /confirm what we inferred/i }))
    .toBeVisible({ timeout: 60_000 });
  await page.getByRole("button", { name: /Confirm \+ continue/i }).click();
}

async function walkPillar2(page: Page): Promise<void> {
  await expect(page.getByRole("heading", { name: /Verifying your setup/i }))
    .toBeVisible();

  // Default plan = Max 5×; just hit Verify & Continue.
  const verifyBtn = page.getByRole("button", { name: /Verify.*Continue/i });
  await verifyBtn.click();

  if (process.env.WAVEX_E2E_SKIP_PILLAR2_VERIFY === "1") {
    test.skip(true, "Pillar 2 verify skipped via env (claude not installed in this environment)");
  }

  // After successful verify, button transitions to "Continue →" (already past).
  // We wait for the Pillar 3 heading to confirm advance.
  await expect(page.getByRole("heading", { name: /Pillar 3/i }))
    .toBeVisible({ timeout: 60_000 });
}

async function walkPillar3(page: Page): Promise<void> {
  await expect(page.getByRole("heading", { name: /Pillar 3/i })).toBeVisible();
  // Default product_state = live_paying_customers, default stage = 10k_100k_mrr; baseline preview should show.
  await expect(page.getByText(/Baseline preview/i)).toBeVisible();
  await page.getByRole("button", { name: /^Next/i }).click();
  await expect(page.getByRole("heading", { name: /Pillar 4/i })).toBeVisible();
}

async function walkPillar4(page: Page): Promise<void> {
  await expect(page.getByRole("heading", { name: /Pillar 4/i })).toBeVisible();

  // Default lead_sources = ["outbound_cold"], sales_motion = "high_touch_enterprise" — needsClose should fire.
  // GTM profile preview card should appear with derived enum.
  await expect(page.getByText(/Looks like you're/i)).toBeVisible();

  await page.getByRole("button", { name: /^Next/i }).click();
  await expect(page.getByRole("heading", { name: /Pillar 5/i })).toBeVisible();
}

async function walkPillar5(page: Page): Promise<void> {
  await expect(page.getByRole("heading", { name: /Pillar 5/i })).toBeVisible();
  // Default channel = telegram. Telegram credentials section visible (with BotFather links).
  await expect(page.getByText(/Telegram credentials/i)).toBeVisible();
  // Skip credentials — leave fields empty, click Finish.
  await page.getByRole("button", { name: /Finish Phase 1/i }).click();
  await expect(page.getByRole("heading", { name: /Phase 2.*Connectors/i }))
    .toBeVisible({ timeout: 30_000 });
}

async function walkPhase2(page: Page): Promise<void> {
  await expect(page.getByRole("heading", { name: /Phase 2.*Connectors/i })).toBeVisible();

  // The Re-derive (T0 fast) auto-runs on mount; required + suggested headings appear.
  await expect(page.getByRole("heading", { name: /^Required$/i }))
    .toBeVisible({ timeout: 15_000 });

  // Continue to credential concierge.
  await page.getByRole("button", { name: /Continue.*swarm/i }).click();
  await expect(page.getByRole("heading", { name: /Credential Concierge/i }))
    .toBeVisible({ timeout: 15_000 });
}

async function walkConcierge(page: Page): Promise<void> {
  await expect(page.getByRole("heading", { name: /Credential Concierge/i })).toBeVisible();

  // Wait for the connector list to load.
  await expect(page.getByRole("heading", { name: /^Required$/i }))
    .toBeVisible({ timeout: 15_000 });

  // For every required connector that's still pending, click Skip → confirm with default reason.
  // We do this via the Skip button per-card; use a loop because the count varies per fixture.
  // The "Continue → swarm" stays disabled until all required are addressed.

  // Find every Skip button under a "Required" group, click it, then Confirm skip.
  // The simplest path: click Skip + Confirm skip in turn for each card that has one.
  let safety = 20;
  while (safety-- > 0) {
    const skipBtn = page.getByRole("button", { name: /^Skip$/ }).first();
    if (!(await skipBtn.isVisible().catch(() => false))) break;
    await skipBtn.click();
    // The Confirm skip button appears in the same card; click the first matching.
    await page.getByRole("button", { name: /Confirm skip/i }).first().click();
    // Wait for the card status to update (the Skip button disappears for that card).
    await page.waitForTimeout(300);
  }

  // Continue should now be enabled.
  const continueBtn = page.getByRole("button", { name: /Continue.*swarm/i });
  await expect(continueBtn).toBeEnabled({ timeout: 10_000 });
  await continueBtn.click();

  await expect(page.getByRole("heading", { name: /Phase 3.*Swarm/i }))
    .toBeVisible({ timeout: 15_000 });
}

async function walkPhase3(page: Page): Promise<void> {
  await expect(page.getByRole("heading", { name: /Phase 3.*Swarm/i })).toBeVisible();
  // Topology summary renders with active count > 0.
  await expect(page.getByText(/active/i).first()).toBeVisible({ timeout: 15_000 });
  await page.getByRole("button", { name: /Continue.*workflows/i }).click();
  await expect(page.getByRole("heading", { name: /Phase 4.*Workflows/i }))
    .toBeVisible({ timeout: 15_000 });
}

async function walkPhase4(page: Page): Promise<void> {
  await expect(page.getByRole("heading", { name: /Phase 4.*Workflows/i })).toBeVisible();
  await expect(page.getByText(/Per-agent workflows/i)).toBeVisible({ timeout: 15_000 });
  await page.getByRole("button", { name: /Continue.*finalize/i }).click();
  await expect(page.getByRole("heading", { name: /^Finalize$/i }))
    .toBeVisible({ timeout: 15_000 });
}

async function walkFinalize(page: Page): Promise<void> {
  await expect(page.getByRole("heading", { name: /^Finalize$/i })).toBeVisible();

  // Skip T2 inference for speed — finalize still runs MC + signs the manifest.
  await page.getByRole("checkbox", { name: /Skip T2 inference/i }).check();
  await page.getByRole("button", { name: /Finalize.*sign/i }).click();

  // After success: MATERIALIZED card with sha256.
  await expect(page.getByText(/MATERIALIZED/i)).toBeVisible({ timeout: 60_000 });
  const sha = page.getByTestId("finalize-sha256");
  await expect(sha).toBeVisible();
  await expect(sha).toContainText(/[0-9a-f]{64}/);
}

test.describe("onboarding wizard — full walk", () => {
  test("walks welcome → 5 pillars → 3 phases → concierge → finalize", async ({ page }) => {
    test.slow(); // overall walk takes 1-2 minutes

    // Welcome screen
    await page.goto("/onboarding");
    await expect(page.getByRole("heading", { name: /Onboarding/i }).first()).toBeVisible();
    await page.locator("input[autofocus], input:not([type='radio']):not([type='checkbox'])").first().fill(COMPANY_NAME);
    await page.getByRole("button", { name: /^Start/i }).click();

    // Now in Pillar 1
    await walkPillar1(page);
    await walkPillar2(page);
    await walkPillar3(page);
    await walkPillar4(page);
    await walkPillar5(page);
    await walkPhase2(page);
    await walkConcierge(page);
    await walkPhase3(page);
    await walkPhase4(page);
    await walkFinalize(page);
  });
});

export { COMPANY_SLUG, COMPANY_NAME };
