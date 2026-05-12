/** Playwright e2e — chat-first onboarding walk against /onboarding-chat.
 *
 *  Runs the same operator path as full-t2-walk.spec.ts but asserts against
 *  the new chat shell: welcome turn → Pillar 1 confirm card → Pillars 3-5
 *  prompt cards (ResponseChips) → connector picker → credential drawer →
 *  Swarm Studio reveal → Imprint Theater (MC race → winner → streaming
 *  imprint) → pricing dialog → activate progress → Mission Control.
 *
 *  Skipped by default. Set WAVEX_E2E_T2=1 to run.
 *  Requires: claude CLI + Paperclip server on :3100/:5174 + wavex on :5173/:3101. */

import { test, expect, type Page } from "@playwright/test";

const RUN_T2 = process.env.WAVEX_E2E_T2 === "1";

// Use a stable, scrapable URL so Pillar 1 enrichment produces real context.
// "ricoma" maps the URL hostname to the derived slug.
const RAW_INPUT = "ricoma.com";
const EXPECTED_SLUG = "ricoma";

async function sendChat(page: Page, text: string): Promise<void> {
  const input = page.getByPlaceholder(/Type a message/i);
  await input.fill(text);
  await input.press("Enter");
}

test.describe("chat-first onboarding @ /onboarding-chat", () => {
  test.skip(!RUN_T2, "Set WAVEX_E2E_T2=1 to run (requires claude CLI + auth)");

  test("welcome → pillars (T2) → connectors → swarm → theater → activate → mission control", async ({ page }) => {
    test.setTimeout(20 * 60 * 1000); // 20 min ceiling

    // ── Welcome (centered empty-state hero) ───────────────────────────
    await page.goto("/onboarding-chat");
    await expect(page.getByRole("heading", { name: /What do you want to build/i })).toBeVisible();
    // The hero input has placeholder "Ask anything…"
    const heroInput = page.getByPlaceholder(/Ask anything/i);
    await heroInput.fill(RAW_INPUT);
    await heroInput.press("Enter");

    // URL should now include ?companyId=
    await expect(page).toHaveURL(new RegExp(`companyId=${EXPECTED_SLUG}`));

    // ── Pillar 1 (real T2) → confirm card ─────────────────────────────
    // The T2 inference takes 60-180s. Wait for the confirm card to appear.
    await expect(page.getByRole("button", { name: /Looks right.*keep going|Update.*continue/i }))
      .toBeVisible({ timeout: 300_000 });
    await page.getByRole("button", { name: /Looks right.*keep going|Update.*continue/i }).click();

    // ── Scope picker (after silent Pillar 2 verify) ───────────────────
    // Real-T2 walk uses FOCUSED scope (marketing + revenue) so we verify
    // both the inference path AND the scope filter park non-scoped chiefs.
    // The raw_input "ricoma.com" doesn't trip keyword detection, so the
    // card opens in "full" mode by default — flip to focused, chip the
    // two divisions, then continue.
    await expect(page.getByText(/How big should this team be|Tell me how to scope/i))
      .toBeVisible({ timeout: 60_000 });
    await page.getByRole("button", { name: /Focused on specific divisions/i }).click();
    await page.getByRole("button", { name: /^Marketing$/i }).click();
    await page.getByRole("button", { name: /Sales.*Revenue/i }).click();
    await page.getByRole("button", { name: /^Continue/ }).last().click();

    // ── Pillar 3 prompt card ──────────────────────────────────────────
    await expect(page.getByText(/Where are you in the product journey/i))
      .toBeVisible({ timeout: 60_000 });
    await page.getByRole("button", { name: /Live with paying customers/i }).click();
    await page.getByRole("button", { name: /\$10k.*100k/i }).click();
    await page.getByRole("button", { name: /^Continue/ }).last().click();

    // ── Pillar 4 prompt card ──────────────────────────────────────────
    await expect(page.getByText(/How do leads come in/i)).toBeVisible({ timeout: 30_000 });
    await page.getByRole("button", { name: /Inbound ads/i }).click();
    await page.getByRole("button", { name: /Referral/i }).click();
    await page.getByRole("button", { name: /Assisted.*demo required/i }).click();
    await page.getByRole("button", { name: /Mostly phone/i }).click();
    await page.getByRole("button", { name: /^Continue/ }).last().click();

    // ── Pillar 5 prompt card ──────────────────────────────────────────
    await expect(page.getByText(/How do you want your board to talk to you/i))
      .toBeVisible({ timeout: 30_000 });
    await page.getByRole("button", { name: /^Slack$/i }).click();
    await page.getByRole("button", { name: /Daily digest/i }).click();
    await page.getByRole("button", { name: /^Continue/ }).last().click();

    // ── Connector picker card (post-T2) ───────────────────────────────
    await expect(page.getByRole("button", { name: /These look right.*plug them in/i }))
      .toBeVisible({ timeout: 240_000 });
    await page.getByRole("button", { name: /These look right.*plug them in/i }).click();

    // ── Credential drawer slides up ───────────────────────────────────
    await expect(page.getByRole("heading", { name: /Credentials/i })).toBeVisible({ timeout: 10_000 });
    // For the demo, skip every required connector
    let safety = 25;
    while (safety-- > 0) {
      const skip = page.getByRole("button", { name: /^Skip$/ }).first();
      if (!(await skip.isVisible().catch(() => false))) break;
      await skip.click();
      await page.getByRole("button", { name: /Confirm skip/i }).first().click();
      await page.waitForTimeout(250);
    }
    await page.getByRole("button", { name: /Done.*continue to swarm/i }).click();

    // ── Swarm Studio (full-screen, after T2 swarm gen) ────────────────
    await expect(page.getByRole("button", { name: /These look right.*wire them up/i }))
      .toBeVisible({ timeout: 240_000 });
    // Total slot count should be 30+ even with focused scope (parked
    // agents still render, just dimmed).
    await expect(page.getByText(/\d{2,} agents/)).toBeVisible();

    // Verify the scope filter actually parked non-marketing/revenue
    // chiefs by reading the swarm manifest from the API. CFO/CDO/COO
    // should be parked; CMO/CRO + their reports should be active.
    const swarmResp = await page.request.get(
      `/op-omega/onboarding/swarm-manifest?companyId=${EXPECTED_SLUG}`,
    );
    expect(swarmResp.ok()).toBeTruthy();
    const swarmJson = await swarmResp.json();
    const agents = swarmJson.manifest.agents as Record<string, { status: string; department: string }>;
    const cmoStatus = agents.cmo?.status;
    const croStatus = agents.cro?.status;
    const cfoStatus = agents.cfo?.status;
    const cdoStatus = agents.cdo?.status;
    const cooStatus = agents.coo?.status;
    expect(cmoStatus, "CMO should be active in marketing+revenue scope").toBe("active");
    expect(croStatus, "CRO should be active in marketing+revenue scope").toBe("active");
    expect(cfoStatus, "CFO should be parked outside marketing+revenue scope").toBe("parked");
    expect(cdoStatus, "CDO should be parked outside marketing+revenue scope").toBe("parked");
    expect(cooStatus, "COO should be parked outside marketing+revenue scope").toBe("parked");

    await page.getByRole("button", { name: /These look right.*wire them up/i }).click();

    // ── Imprint Theater ───────────────────────────────────────────────
    // Preparing screen appears first.
    await expect(page.getByText(/Preparing your launch/i)).toBeVisible({ timeout: 10_000 });
    // After finalize (1-3 min) Acts 1-3 play. Act 3 streams the imprint
    // char-by-char at ~60chars/sec — Let's Launch stays disabled until
    // the stream completes. Wait for enabled, not just visible.
    const launch = page.getByRole("button", { name: /Let's launch/i });
    await expect(launch).toBeVisible({ timeout: 300_000 });
    await expect(launch).toBeEnabled({ timeout: 120_000 });
    await launch.click();

    // ── Pricing dialog ────────────────────────────────────────────────
    await expect(page.getByRole("heading", { name: /System Optimizer subscription/i }))
      .toBeVisible({ timeout: 10_000 });
    // Click "Most popular" tier (Founder) — text varies; rely on the
    // button next to the badge.
    await page.getByRole("button", { name: /Skip.*continue without subscription/i }).click();

    // ── Activate progress ─────────────────────────────────────────────
    await expect(page.getByRole("button", { name: /Open Mission Control/i }))
      .toBeVisible({ timeout: 60_000 });
    await page.getByRole("button", { name: /Open Mission Control/i }).click();

    // ── Mission Control ───────────────────────────────────────────────
    await expect(page).toHaveURL(new RegExp(`\\?companyId=${EXPECTED_SLUG}`));
    await expect(page.getByRole("heading", { name: /KPI scoreboard/i })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/Fleet · \d+ agents/)).toBeVisible({ timeout: 15_000 });
  });
});
