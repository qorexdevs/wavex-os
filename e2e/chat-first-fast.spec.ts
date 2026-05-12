/** Fast smoke walk against /onboarding-chat?t0=1 — every T2 path returns
 *  deterministic fallbacks, so the whole walk completes in ~30-60s without
 *  needing claude CLI or any API keys.
 *
 *  Use this whenever you want to confirm the chat flow renders + transitions
 *  correctly without paying for the real inference. The full-fidelity walk
 *  lives in chat-first-walk.spec.ts (gated on WAVEX_E2E_T2=1).
 *
 *  Run headed:
 *    pnpm exec playwright test e2e/chat-first-fast.spec.ts --headed
 *  Run all:
 *    pnpm test:e2e e2e/chat-first-fast.spec.ts */

import { test, expect } from "@playwright/test";

const RAW_INPUT = "I'm building a B2B marketing automation SaaS at $50K MRR. I need a marketing and sales AI team to supplement my two-person GTM crew.";
const EXPECTED_SLUG = /^company|^i-m-building|^[a-z0-9-]+$/;

test.describe("chat-first fast walk @ /onboarding-chat?t0=1", () => {
  test("hero → pillars → scope → connectors → swarm studio → theater → activate", async ({ page }) => {
    test.setTimeout(120_000);

    // ── Hero (empty state) ────────────────────────────────────────────
    await page.goto("/onboarding-chat?t0=1");
    await expect(page.getByRole("heading", { name: /What do you want to build/i }))
      .toBeVisible({ timeout: 10_000 });
    // Confirm fast-mode badge renders
    await expect(page.getByText(/^Fast mode$/)).toBeVisible();
    // Top bar is hidden in empty state — confirm no progress bar at the top
    // (it appears only post-first-message)
    const heroInput = page.getByPlaceholder(/Ask anything/i);
    await heroInput.fill(RAW_INPUT);
    await heroInput.press("Enter");

    // URL should include ?companyId=… and preserve ?t0=1
    await expect(page).toHaveURL(/companyId=/);
    await expect(page).toHaveURL(/t0=1/);

    // ── Pillar 1 confirm card (fallback path → fast) ──────────────────
    await expect(page.getByRole("button", { name: /Looks right.*keep going|Update.*continue/i }))
      .toBeVisible({ timeout: 30_000 });
    await page.getByRole("button", { name: /Looks right.*keep going|Update.*continue/i }).click();

    // ── Scope picker — keyword detection should have pre-selected ─────
    // Marketing + Sales because the raw_input mentioned both. The card
    // already opens in "focused" mode with those chips active, so don't
    // click the Focused chip again (that would deselect it under the new
    // single-mode deselect behavior).
    await expect(page.getByText(/Sounds like you want to focus|How big should this team be/i))
      .toBeVisible({ timeout: 30_000 });
    await expect(page.getByText(/Which divisions/i)).toBeVisible();
    await page.getByRole("button", { name: /^Continue/ }).last().click();

    // ── Pillar 3 ──────────────────────────────────────────────────────
    await expect(page.getByText(/Where are you in the product journey/i))
      .toBeVisible({ timeout: 15_000 });
    await page.getByRole("button", { name: /Live with paying customers/i }).click();
    await page.getByRole("button", { name: /\$10k.*100k/i }).click();
    await page.getByRole("button", { name: /^Continue/ }).last().click();

    // ── Pillar 4 ──────────────────────────────────────────────────────
    await expect(page.getByText(/How do leads come in/i)).toBeVisible({ timeout: 15_000 });
    await page.getByRole("button", { name: /Inbound ads/i }).click();
    await page.getByRole("button", { name: /Referral/i }).click();
    await page.getByRole("button", { name: /Assisted.*demo required/i }).click();
    await page.getByRole("button", { name: /Mostly phone/i }).click();
    await page.getByRole("button", { name: /^Continue/ }).last().click();

    // ── Pillar 5 ──────────────────────────────────────────────────────
    await expect(page.getByText(/How do you want your board to talk to you/i))
      .toBeVisible({ timeout: 15_000 });
    await page.getByRole("button", { name: /^Slack$/i }).click();
    await page.getByRole("button", { name: /Daily digest/i }).click();
    await page.getByRole("button", { name: /^Continue/ }).last().click();

    // ── Connector picker card ─────────────────────────────────────────
    await expect(page.getByRole("button", { name: /These look right.*plug them in/i }))
      .toBeVisible({ timeout: 30_000 });
    await page.getByRole("button", { name: /These look right.*plug them in/i }).click();

    // ── Credential drawer: skip every required ────────────────────────
    await expect(page.getByRole("heading", { name: /Credentials/i }))
      .toBeVisible({ timeout: 10_000 });
    let safety = 15;
    while (safety-- > 0) {
      const skip = page.getByRole("button", { name: /^Skip$/ }).first();
      if (!(await skip.isVisible().catch(() => false))) break;
      await skip.click();
      await page.getByRole("button", { name: /Confirm skip/i }).first().click();
      await page.waitForTimeout(200);
    }
    await page.getByRole("button", { name: /Done.*continue to swarm/i }).click();

    // ── Swarm Studio takeover ─────────────────────────────────────────
    await expect(page.getByRole("button", { name: /These look right.*wire them up/i }))
      .toBeVisible({ timeout: 30_000 });
    // Should show ~7 active agents for marketing+revenue focused scope
    // (rest are parked). Footer shows total agent count.
    await expect(page.getByText(/\d+ agents/)).toBeVisible();
    await page.getByRole("button", { name: /These look right.*wire them up/i }).click();

    // ── Imprint Theater ───────────────────────────────────────────────
    // Fast mode skips imprint T2 → fallback prose → much faster.
    // The "Let's launch" button stays disabled until the imprint stream
    // finishes; wait for enabled state.
    const launch = page.getByRole("button", { name: /Let's launch/i });
    await expect(launch).toBeEnabled({ timeout: 90_000 });
    await launch.click();

    // ── Pricing dialog → Skip ─────────────────────────────────────────
    await expect(page.getByRole("heading", { name: /System Optimizer subscription/i }))
      .toBeVisible({ timeout: 10_000 });
    await page.getByRole("button", { name: /Skip.*continue without subscription/i }).click();

    // ── Activate ──────────────────────────────────────────────────────
    await expect(page.getByRole("button", { name: /Open Mission Control/i }))
      .toBeVisible({ timeout: 30_000 });

    // Sanity: slug derivation worked
    const url = page.url();
    const m = /companyId=([^&]+)/.exec(url);
    expect(m?.[1]).toMatch(EXPECTED_SLUG);
  });
});
