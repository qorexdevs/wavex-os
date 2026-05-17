/** Phase 7-C — Avatar Settings page smoke. Creates an ephemeral avatar
 *  via the API, walks the settings UI (profile edit + trust toggle +
 *  per-tool meta save), then exercises the typed-DELETE confirm flow
 *  and verifies the avatar directory is gone. */

import { chromium } from "@playwright/test";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

const BASE = "http://127.0.0.1:5173";
const API = "http://127.0.0.1:3101";
const AVATAR_ROOT = join(homedir(), ".wavex-os", "instances", "default", "avatars");

function assert(cond, msg) {
  if (!cond) throw new Error(`✗ ${msg}`);
}

async function main() {
  // 1. Create an ephemeral avatar via the API so the delete test doesn't
  //    touch the long-lived dashboard test data.
  const created = await fetch(`${API}/wavex-os/onboarding/avatar`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "Smoke Settings",
      role: "QA Engineer",
      workingHours: ["09:00", "17:00"],
      tz: "America/New_York",
    }),
  }).then((r) => r.json());
  assert(created.ok, `failed to create avatar: ${JSON.stringify(created)}`);
  const AID = created.avatarId;
  console.log(`✓ created ephemeral avatar ${AID}`);

  // Seed trust so the settings page has values to show
  await fetch(`${API}/wavex-os/onboarding/avatar/${AID}/trust`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      autonomy_preset: "cautious", vips: [], privacy_zones: [], notify: ["now_drafts"],
    }),
  }).then((r) => r.json());

  // Seed a gmail connection so the per-tool meta panel renders
  await fetch(`${API}/wavex-os/onboarding/avatar/${AID}/tools`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ provider: "gmail" }),
  }).then((r) => r.json());

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.addInitScript(() => {
    localStorage.setItem("coachmark-avatar-v1", "1");
    localStorage.setItem("coachmark-mission-v1", "1");
  });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));

  await page.goto(`${BASE}/avatar/${AID}/settings`);
  await page.waitForSelector("text=/Avatar settings/i", { timeout: 5_000 });
  console.log("✓ settings page rendered");

  // 2. Edit role + save profile
  const roleInput = page.locator("input").nth(1); // name is first, role second
  await roleInput.fill("Smoke QA Lead");
  await page.locator("section").filter({ hasText: /^Profile/ }).locator("button:has-text('Save')").click();
  await page.waitForSelector("text=/Saved at/i", { timeout: 5_000 });
  console.log("✓ profile saved");

  // 3. Toggle autonomy to balanced + save trust
  await page.locator("button").filter({ hasText: /^Balanced/ }).first().click();
  await page.locator("section").filter({ hasText: /^Trust & boundaries/ }).locator("button:has-text('Save')").click();
  await page.waitForSelector("text=/Trust & boundaries[\\s\\S]*Saved at/i", { timeout: 5_000 });
  console.log("✓ trust saved");

  // 4. Add a VIP under Gmail tool meta + save
  await page.locator("[aria-label='gmail VIPs']").fill("sarah@accel.example");
  await page.locator("[aria-label='gmail VIPs']").press("Enter");
  await page.locator("section").filter({ hasText: /Per-tool personalization/ }).locator("button:has-text('Save')").first().click();
  await page.waitForTimeout(600);
  console.log("✓ gmail tool meta saved");

  // 5. Backend cross-check — profile.json has the new role, trust.json balanced
  const after = await fetch(`${API}/api/avatar/${AID}`).then((r) => r.json());
  assert(after.profile.role === "Smoke QA Lead", `profile.role should update; got ${after.profile.role}`);
  const trust = await fetch(`${API}/api/avatar/${AID}/trust`).then((r) => r.json());
  assert(trust.trust?.autonomy_preset === "balanced", `trust preset should be balanced; got ${trust.trust?.autonomy_preset}`);
  console.log(`✓ backend reflects edits (role="${after.profile.role}", preset=${trust.trust.autonomy_preset})`);

  // 6. Delete avatar with typed confirm
  await page.locator("button:has-text('Delete avatar')").first().click();
  await page.waitForSelector("text=/Type DELETE to confirm/i", { timeout: 5_000 });
  await page.locator("[placeholder='DELETE']").fill("DELETE");
  await page.locator("button:has-text('Delete avatar')").nth(1).click();
  await page.waitForURL(/\/$/, { timeout: 5_000 });
  console.log("✓ delete confirmed, redirected to /");

  // 7. Disk check — avatar directory is gone
  const dir = join(AVATAR_ROOT, AID);
  assert(!existsSync(dir), `avatar directory should be removed; still exists at ${dir}`);
  console.log("✓ avatar directory removed from disk");

  if (errors.length) {
    console.log("\n⚠ runtime errors:");
    for (const e of errors) console.log("  ", e);
    throw new Error("page errors during walk");
  }
  console.log("\n✓ Avatar settings smoke passed");
  await browser.close();
}

main().catch((e) => {
  console.error(`\n✗ ${e.message}`);
  process.exit(1);
});
