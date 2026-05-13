/** Phase 2 dashboard smoke — lands directly on an existing Avatar, walks
 *  the three tabs (Overview / Approval inbox / Audit log), triggers a
 *  triage run, approves one of the drafts, and confirms the audit entry
 *  shows up. Assumes onboarding-ui (5173) + mock-core (3101) + Paperclip
 *  API (3100) are already running. */

import { chromium } from "@playwright/test";

const BASE = "http://127.0.0.1:5173";
const API = "http://127.0.0.1:3101";
const AVATAR = process.env.AVATAR_ID ?? "bridge-v2-2e55";

async function main() {
  const before = await fetch(`${API}/api/avatar/${AVATAR}/approvals?status=pending`).then((r) => r.json());
  const startPending = Array.isArray(before.approvals) ? before.approvals.length : 0;
  console.log(`baseline: ${startPending} pending approvals for ${AVATAR}`);

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(`[console] ${msg.text()}`);
  });

  await page.goto(`${BASE}/avatar/${AVATAR}`);
  await page.waitForLoadState("networkidle");

  // Overview renders
  await page.waitForSelector("text=/Your avatar/i", { timeout: 5_000 });
  await page.waitForSelector("text=/Connected tools/i", { timeout: 5_000 });
  await page.waitForSelector("text=/Voice profile/i", { timeout: 5_000 });
  console.log("✓ Overview tab rendered");

  // Switch to Approval inbox
  await page.locator("button").filter({ hasText: /^Approval inbox$/ }).click();
  await page.waitForSelector("button:has-text('Process now')", { timeout: 5_000 });
  console.log("✓ Approval inbox tab loaded");

  // Autonomy chip — copy varies by tier; just confirm one of the
  // friendly variants is present (or skip if no trust.json).
  const chip = page.locator("button", { hasText: /trust me with more|fully trusted|I wait for your approval/i }).first();
  if (await chip.count() > 0) {
    const label = await chip.textContent();
    console.log(`✓ Autonomy chip: ${label?.trim()}`);
  } else {
    console.log("· Autonomy chip absent (no trust.json yet)");
  }

  // List should already contain the seeded approvals (if any pending)
  if (startPending > 0) {
    await page.waitForSelector("text=/Series A|Coffee next week|Stripe digest/i", { timeout: 5_000 });
    console.log(`✓ Saw ${startPending} pre-existing pending approval(s)`);
  }

  // Trigger gmail triage via the new per-provider menu
  await page.locator("button").filter({ hasText: /^Process now/ }).first().click();
  await page.locator("button").filter({ hasText: /^Gmail$/ }).first().click();
  await page.waitForSelector("text=/Read \\d+ Gmail thread/i", { timeout: 15_000 });
  const runStatus = await page.locator("text=/Read \\d+ Gmail thread/i").first().textContent();
  console.log(`✓ Triage run completed → ${runStatus?.trim()}`);

  // After refresh the inbox should have at least 1 pending approval card
  await page.waitForSelector("button:has-text('Approve')", { timeout: 5_000 });
  const approveBtns = await page.locator("button:has-text('Approve')").count();
  console.log(`✓ ${approveBtns} pending card(s) showing Approve button`);

  // Approve the first one
  await page.locator("button:has-text('Approve')").first().click();
  await page.waitForTimeout(800); // allow refresh
  console.log("✓ Approved first draft");

  // Per-skill kill switch: pause then resume gmail
  const pauseGmail = page.locator("button:has-text('pause Gmail')").first();
  await pauseGmail.waitFor({ timeout: 5_000 });
  await pauseGmail.click();
  await page.waitForSelector("button:has-text('resume Gmail')", { timeout: 5_000 });
  console.log("✓ Paused gmail skill");
  await page.locator("button:has-text('resume Gmail')").first().click();
  await page.waitForSelector("button:has-text('pause Gmail')", { timeout: 5_000 });
  console.log("✓ Resumed gmail skill");

  // Switch to Audit tab — Phase 7-A humanizes the action strings, so
  // look for the friendly copy ("Drafted a Gmail reply" / "You approved
  // a draft" / "Paused gmail" / etc.) instead of the raw namespace.
  await page.locator("button").filter({ hasText: /^Audit log$/ }).click();
  await page.waitForSelector("text=/Drafted a Gmail reply|You approved a draft|Auto-approved on your behalf|Paused Gmail|Resumed Gmail/i", { timeout: 5_000 });
  const auditCount = await page.locator("span[title^='avatar.'], span[title^='agent.']").count();
  console.log(`✓ Audit log rendered (${auditCount} entries visible)`);

  if (errors.length) {
    console.log("⚠ runtime errors:");
    for (const e of errors) console.log("  ", e);
  }

  // Backend cross-check
  const after = await fetch(`${API}/api/avatar/${AVATAR}/audit?limit=50`).then((r) => r.json());
  const totalAudit = Array.isArray(after.entries) ? after.entries.length : 0;
  console.log(`backend: ${totalAudit} total audit entries`);

  if (errors.length > 0) {
    console.error("\n✗ Smoke failed: runtime errors above");
    process.exit(1);
  }
  console.log("\n✓ Avatar dashboard smoke passed");
  await browser.close();
}

main().catch((e) => {
  console.error("\n✗ Smoke failed:", e.message);
  process.exit(1);
});
