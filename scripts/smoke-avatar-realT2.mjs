/** Real-T2 end-to-end smoke for the Avatar route — no ?t0=1 fast mode,
 *  no skipInference shortcuts. Walks the full onboarding, asserts each
 *  T2 call actually fired (parse extracts a real name, voice profile is
 *  source="t2", triage approvals carry T2-generated reasoning), then
 *  navigates to the dashboard and runs a triage with real inference.
 *
 *  Expected runtime: ~3-5 minutes (5 T2 calls in series). Requires the
 *  claude CLI to be reachable (default OAuth mode). */

import { chromium } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { homedir } from "node:os";

const BASE = "http://127.0.0.1:5173";
const API = "http://127.0.0.1:3101";
const AVATAR_ROOT = join(homedir(), ".wavex-os", "instances", "default", "avatars");

const INTRO = "I am Dylan, founder at WaveX. I work 9-5 EST. I would hand off email triage first.";
const VOICE_SAMPLES = [
  "Hey Sarah — quick update on the close. Final cap table coming Friday. Looping the CFO so the closing docs columns are the way the lawyers want them. Anything else from us by then?",
  "## Today\n- Ship triage runner\n- Wire OAuth\n- Investor calls 2pm and 4pm\n## Tomorrow\n- Voice profile review\n- Pricing draft",
  "Email triage. Anything that says invoice, demo, or has a deadline in the next 48 hours. The rest can wait until Monday.",
];

async function readAvatarJson(avatarId, file) {
  const path = join(AVATAR_ROOT, avatarId, file);
  return JSON.parse(await readFile(path, "utf8"));
}

function assert(cond, msg) {
  if (!cond) throw new Error(`✗ assertion failed: ${msg}`);
}

async function main() {
  console.log(`real-T2 smoke (this takes ~3-5 minutes; T2 calls are real)`);
  const startedAt = Date.now();

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));

  // 1. Gateway → Avatar
  await page.goto(`${BASE}/onboarding-chat`); // no ?t0=1
  await page.waitForLoadState("networkidle");
  await page.locator("button").filter({ hasText: /Set up my avatar/i }).first().click();
  console.log("✓ picked Avatar");

  // 2. Welcome hero free-text → T2 parse
  await page.waitForSelector("text=/Let's get to know you/i", { timeout: 5_000 });
  await page.locator("textarea[placeholder*=\"I'm\"]").fill(INTRO);
  await page.locator("button", { hasText: /^↑$/ }).first().click();
  console.log("· welcome submitted — waiting for T2 parse…");

  // 3. Profile card lands with parsed fields. Assert real T2 extracted "Dylan".
  await page.waitForSelector("text=/Got it. Here's what I caught/i", { timeout: 30_000 });
  const nameInputValue = await page.locator("input[placeholder='Alex Founder']").inputValue();
  const roleInputValue = await page.locator("input[placeholder*='Indie hacker']").inputValue();
  assert(/dylan/i.test(nameInputValue), `parse should extract "Dylan" from intro; got "${nameInputValue}"`);
  assert(/founder/i.test(roleInputValue), `parse should extract "Founder"; got "${roleInputValue}"`);
  console.log(`✓ T2 parse extracted: name="${nameInputValue}" role="${roleInputValue}"`);

  // 4. Submit profile card (keeps the T2-extracted values)
  await page.locator("button").filter({ hasText: /^Continue/i }).click();
  console.log("· profile confirmed — avatar created on disk");

  // 5. Tools — connect Gmail + Calendar
  await page.waitForSelector("text=/Pick the tools you live in/i", { timeout: 10_000 });
  await page.locator("button").filter({ hasText: /^Connect$/i }).first().click();
  await page.waitForFunction(() => /1 of 8 connected/.test(document.body.textContent ?? ""), undefined, { timeout: 5_000 });
  await page.locator("button").filter({ hasText: /^Skip$/ }).first().click(); // dismiss gmail drawer
  await page.locator("button").filter({ hasText: /^Connect$/i }).first().click();
  await page.waitForFunction(() => /2 of 8 connected/.test(document.body.textContent ?? ""), undefined, { timeout: 5_000 });
  await page.locator("button").filter({ hasText: /Continue →/i }).first().click();
  console.log("✓ tools wired (gmail + calendar)");

  // 6. Voice — 3 real samples → T2 analyzer
  await page.waitForSelector("text=/Show me how you write/i", { timeout: 5_000 });
  const textareas = page.locator("textarea");
  await textareas.nth(0).fill(VOICE_SAMPLES[0]);
  await textareas.nth(1).fill(VOICE_SAMPLES[1]);
  await textareas.nth(2).fill(VOICE_SAMPLES[2]);
  await page.locator("button").filter({ hasText: /Continue →/i }).first().click();
  console.log("· voice submitted — waiting for T2 analyzer (~10-20s)…");

  // 7. Wait for Trust step to land (which means voice T2 finished)
  await page.waitForSelector("text=/How autonomous on day one/i", { timeout: 60_000 });
  console.log("✓ voice analyzer returned");

  // 8. Trust defaults
  await page.locator("button").filter({ hasText: /Continue →/i }).first().click();

  // 9. Suggestions → finalize → land on dashboard
  await page.waitForSelector("text=/Pick what your avatar should start doing/i", { timeout: 30_000 });
  await page.waitForFunction(() => /Launch — /i.test(document.body.textContent ?? ""), undefined, { timeout: 10_000 });
  await page.locator("button").filter({ hasText: /Launch — /i }).first().click();
  await page.waitForURL(/\/avatar\//, { timeout: 15_000 });
  const dashUrl = page.url();
  const avatarId = dashUrl.split("/avatar/")[1];
  console.log(`✓ landed on dashboard: avatarId=${avatarId}`);

  // 10. Backend asserts — voice + parse came from real T2
  const voiceJson = await readAvatarJson(avatarId, "voice.json");
  assert(voiceJson.source === "t2", `voice.json.source should be "t2" (got "${voiceJson.source}")`);
  assert(voiceJson.profile?.tone, `voice.json.profile.tone should be populated; got ${JSON.stringify(voiceJson.profile)}`);
  console.log(`✓ voice analyzer source=t2: tone="${voiceJson.profile.tone}" formality="${voiceJson.profile.formality}" structure="${voiceJson.profile.structure}"`);

  const profileJson = await readAvatarJson(avatarId, "profile.json");
  assert(/dylan/i.test(profileJson.name), `profile.json.name should contain "Dylan"; got "${profileJson.name}"`);
  console.log(`✓ profile.json captured: name="${profileJson.name}" role="${profileJson.role}" tz="${profileJson.tz}"`);

  // 11. Trigger triage with real T2 (dryRun keeps fixture threads but skipInference=false)
  console.log("· triggering real-T2 triage (3 threads, ~30-90s)…");
  const triageResp = await fetch(
    `${API}/api/avatar/${avatarId}/run/gmail-triage?dryRun=true&skipInference=false`,
    { method: "POST" },
  ).then((r) => r.json());
  assert(triageResp.ok, `triage run should succeed; got ${JSON.stringify(triageResp)}`);
  console.log(`✓ triage run: processed=${triageResp.result.processed} drafted=${triageResp.result.drafted} queued=${triageResp.result.approvalsCreated}`);

  // 12. Assert at least one approval has T2-generated reasoning (not a known stub line)
  const apvResp = await fetch(`${API}/api/avatar/${avatarId}/approvals?status=pending`).then((r) => r.json());
  assert(Array.isArray(apvResp.approvals) && apvResp.approvals.length >= 1, `should have ≥1 pending approval; got ${apvResp.approvals?.length}`);
  const stubReasonings = new Set([
    "VIP investor, hard deadline, action requested.",
    "Personal-network ping, no deadline, simple ask.",
    "Transactional / no-reply digest.",
  ]);
  const realReasoningCount = apvResp.approvals.filter((a) => !stubReasonings.has(a.payload?.reasoning)).length;
  assert(realReasoningCount >= 1, `at least one approval should have T2-generated reasoning, not the stub canned text. Approvals: ${JSON.stringify(apvResp.approvals.map((a) => a.payload?.reasoning))}`);
  console.log(`✓ ${realReasoningCount}/${apvResp.approvals.length} approvals carry real T2 reasoning`);
  console.log(`   sample: "${apvResp.approvals[0].payload?.reasoning}"`);

  // 13. Audit log includes the draft_created events
  const auditResp = await fetch(`${API}/api/avatar/${avatarId}/audit?limit=20`).then((r) => r.json());
  const drafts = (auditResp.entries ?? []).filter((e) => e.action === "avatar.gmail.draft_created");
  assert(drafts.length >= 1, `audit log should record draft_created events; got ${drafts.length}`);
  console.log(`✓ audit log: ${drafts.length} draft_created entries`);

  // 14. UI cross-check: the dashboard Inbox tab shows the approvals
  await page.locator("button").filter({ hasText: /^Approval inbox$/ }).click();
  await page.waitForSelector("button:has-text('Approve')", { timeout: 5_000 });
  const approveBtns = await page.locator("button:has-text('Approve')").count();
  console.log(`✓ dashboard inbox shows ${approveBtns} approvable card(s)`);

  if (errors.length) {
    console.log("\n⚠ pageerror(s):");
    for (const e of errors) console.log("  ", e);
    throw new Error("page errors during walk");
  }

  const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1);
  console.log(`\n✓ real-T2 Avatar smoke passed in ${elapsed}s`);
  await browser.close();
}

main().catch((e) => {
  console.error(`\n✗ ${e.message}`);
  process.exit(1);
});
