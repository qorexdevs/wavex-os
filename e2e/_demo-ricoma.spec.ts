/** Demo-style e2e — drives the full wizard with company="ricoma" and
 *  URL="ricoma.com", real T2 enrichment everywhere, then asserts the
 *  Paperclip handoff mirrored 8 agents (CEO + CoS + 6 chiefs).
 *
 *  Run: WAVEX_E2E_T2=1 pnpm exec playwright test e2e/_demo-ricoma.spec.ts
 *
 *  Requires: wavex dev (5173/3101), paperclip server (3100), claude CLI auth. */

import { test, expect, type Page } from "@playwright/test";

const RUN_T2 = process.env.WAVEX_E2E_T2 === "1";

const COMPANY_NAME = "ricoma";
const RAW_INPUT = "ricoma.com";

async function fillNameAndStart(page: Page, name: string): Promise<void> {
  await page.goto("/onboarding"); // no ?t0=1 — real T2 everywhere
  const nameInput = page.locator("input[autofocus], input:not([type='radio']):not([type='checkbox'])").first();
  await nameInput.fill(name);
  await page.getByRole("button", { name: /^Start/i }).click();
  await expect(page.getByRole("heading", { name: /Pillar 1.*who you are/i })).toBeVisible();
}

test.describe("ricoma full T2 → Paperclip handoff", () => {
  test.skip(!RUN_T2, "Set WAVEX_E2E_T2=1 to run (requires claude CLI + auth)");

  test("welcome → pillars (T2) → phases (T2) → finalize (T2 imprint) → activate → paperclip handoff with CoS", async ({ page, request }) => {
    test.setTimeout(20 * 60 * 1000); // 20 min ceiling — real T2 with deep URL

    await fillNameAndStart(page, COMPANY_NAME);

    // ── Pillar 1 ──────────────────────────────────────────────────────
    const pillar1Inputs = page.locator("input[type='text'], input:not([type='radio']):not([type='checkbox']):not([type='password'])");
    await pillar1Inputs.nth(0).fill(COMPANY_NAME);
    await pillar1Inputs.nth(1).fill(RAW_INPUT);
    await page.getByRole("button", { name: /^Next/i }).click();

    await expect(page.getByRole("heading", { name: /confirm what we inferred/i }))
      .toBeVisible({ timeout: 300_000 });
    const enrichedText = await page.getByText(/.{200,}/).first().textContent().catch(() => "");
    expect(enrichedText?.length ?? 0, "T2 enrichment should produce >200 chars of company context").toBeGreaterThan(200);
    await page.getByRole("button", { name: /Confirm \+ continue/i }).click();

    // ── Pillar 2 ──────────────────────────────────────────────────────
    await expect(page.getByRole("heading", { name: /Verifying your setup/i })).toBeVisible();
    await page.getByRole("button", { name: /Verify.*Continue/i }).click();
    await expect(page.getByRole("heading", { name: /Pillar 3/i })).toBeVisible({ timeout: 60_000 });

    // ── Pillar 3-5 (defaults) ─────────────────────────────────────────
    await page.getByRole("button", { name: /^Next/i }).click();
    await expect(page.getByRole("heading", { name: /Pillar 4/i })).toBeVisible();
    await page.getByRole("button", { name: /^Next/i }).click();
    await expect(page.getByRole("heading", { name: /Pillar 5/i })).toBeVisible();
    await page.getByRole("button", { name: /Finish Phase 1/i }).click();
    await expect(page.getByRole("heading", { name: /Phase 2.*Connectors/i }))
      .toBeVisible({ timeout: 30_000 });

    // ── Phase 2 (real T2) ─────────────────────────────────────────────
    const phase2Continue = page.getByRole("button", { name: /Continue.*swarm/i });
    await expect(phase2Continue).toBeEnabled({ timeout: 300_000 });
    await expect(page.getByText(/source:\s*t2/i)).toBeVisible({ timeout: 5_000 });
    await phase2Continue.click();
    await expect(page.getByRole("heading", { name: /Credential Concierge/i })).toBeVisible({ timeout: 15_000 });

    // ── Concierge: skip all ───────────────────────────────────────────
    let safety = 25;
    while (safety-- > 0) {
      const skipBtn = page.getByRole("button", { name: /^Skip$/ }).first();
      if (!(await skipBtn.isVisible().catch(() => false))) break;
      await skipBtn.click();
      await page.getByRole("button", { name: /Confirm skip/i }).first().click();
      await page.waitForTimeout(300);
    }
    await page.getByRole("button", { name: /Continue.*swarm/i }).click();
    await expect(page.getByRole("heading", { name: /Phase 3.*Swarm/i })).toBeVisible({ timeout: 15_000 });

    // ── Phase 3 (real T2 swarm overlay) ───────────────────────────────
    const phase3Continue = page.getByRole("button", { name: /Continue.*workflows/i });
    await expect(phase3Continue).toBeEnabled({ timeout: 300_000 });
    await expect(page.getByText(/source:\s*t2/i)).toBeVisible({ timeout: 5_000 });
    await phase3Continue.click();
    await expect(page.getByRole("heading", { name: /Phase 4.*Workflows/i })).toBeVisible({ timeout: 15_000 });

    // ── Phase 4 (real T2 workflow patches) ────────────────────────────
    const phase4Continue = page.getByRole("button", { name: /Continue.*finalize/i });
    await expect(phase4Continue).toBeEnabled({ timeout: 300_000 });
    await expect(page.getByText(/source:\s*t2/i)).toBeVisible({ timeout: 5_000 });
    await phase4Continue.click();
    await expect(page.getByRole("heading", { name: /^Finalize$/i })).toBeVisible({ timeout: 15_000 });

    // ── Finalize (real T2 imprint, NO skip checkbox) ──────────────────
    await page.getByRole("button", { name: /Finalize.*sign/i }).click();
    await expect(page.getByText(/MATERIALIZED/i)).toBeVisible({ timeout: 300_000 });
    await expect(page.getByText(/source:\s*t2/i).first()).toBeVisible();
    await expect(page.getByText(/^Imprint:/i)).toBeVisible();

    // ── Activate → handoff ────────────────────────────────────────────
    await page.getByRole("button", { name: /Activate fleet/i }).click();
    await expect(page.getByText(/Activated.*agents written to db/i)).toBeVisible({ timeout: 30_000 });

    // Handoff status must be the SUCCESS variant (not "not detected" / "failed").
    // Count is the full wavex fleet (33 base + 1 kernel CoS + any C-Suite extras
    // from origin's vendored work) — match a 2-digit number to stay generic
    // across roster-size changes.
    await expect(page.getByText(/Mirrored \d{2,} agents to Paperclip/i)).toBeVisible({ timeout: 30_000 });

    // ── Verify Paperclip received the company + all 8 V1 slots ────────
    // Re-fetch via the wavex-side activate response shape would be cleaner,
    // but the activate already happened; we cross-check Paperclip directly.
    const pclipCompanies = await request.get("http://127.0.0.1:3100/api/companies");
    expect(pclipCompanies.ok()).toBeTruthy();
    const cosList = await pclipCompanies.json();
    const arr = Array.isArray(cosList) ? cosList : cosList.companies ?? [];
    const us = arr.find((c: { name: string }) => c.name === `wavex-os/${COMPANY_NAME}`);
    expect(us, "Paperclip should contain wavex-os/ricoma").toBeTruthy();

    const pclipAgents = await request.get(`http://127.0.0.1:3100/api/companies/${us.id}/agents`);
    expect(pclipAgents.ok()).toBeTruthy();
    const agentsList = await pclipAgents.json();
    const agentArr: Array<{ name: string; role: string; capabilities?: string }> =
      Array.isArray(agentsList) ? agentsList : agentsList.agents ?? [];
    const agentNames = agentArr.map((a) => a.name);
    // Paperclip should mirror the FULL wavex roster (post-V1-removal),
    // not just the C-suite. Cross-check by fetching wavex's count and
    // asserting Paperclip matches.
    const wavexAgentsResp = await request.get(`http://127.0.0.1:3101/api/agents?companyId=${COMPANY_NAME}`);
    const wavexAgents = await wavexAgentsResp.json();
    const wavexCount = (wavexAgents.agents ?? []).length;
    expect(wavexCount, "wavex should have 30+ agents").toBeGreaterThanOrEqual(30);
    expect(agentArr.length, "Paperclip count should equal wavex count after full handoff")
      .toBe(wavexCount);
    // CoS check — the wavex slot ceo.chief-of-staff becomes name CEO / CHIEF-OF-STAFF
    const cosAgent = agentArr.find((a) => /chief.of.staff/i.test(a.name) || /chief.of.staff/i.test(a.capabilities ?? ""));
    expect(cosAgent, "Chief of Staff must appear in Paperclip after handoff").toBeTruthy();

    // ── Mission Control ───────────────────────────────────────────────
    await page.getByRole("button", { name: /Open Mission Control/i }).click();
    await expect(page.getByRole("heading", { name: /KPI scoreboard/i })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/Fleet · \d+ agents/)).toBeVisible({ timeout: 15_000 });
    // Should show "Chief of Staff" node in the FleetGraph
    await expect(page.getByText(/^Chief of Staff$/, { exact: true }).first()).toBeVisible({ timeout: 10_000 });
  });
});
