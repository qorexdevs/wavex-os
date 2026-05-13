#!/usr/bin/env node
/** demo-walk.mjs — walks through the full chat-first onboarding at human
 *  pace and records the entire session to a .webm file.
 *
 *  Uses ?t0=1 fast mode so the inference phases don't hold up the recording
 *  past 5 minutes. Pauses are realistic: 2-4s between clicks, slow typing,
 *  brief dwells to "read" each card before advancing.
 *
 *  Target runtime: under 4:30. Output: scripts/demo-recordings/<slug>.webm
 *
 *  Run:
 *    node scripts/demo-walk.mjs                  → fresh slug, full walk
 *    node scripts/demo-walk.mjs <companyId>      → use a specific slug
 *
 *  Add HEADED=1 to watch the walk live (otherwise runs hidden so it can't be
 *  accidentally closed mid-recording):
 *    HEADED=1 node scripts/demo-walk.mjs
 *
 *  Convert webm → mp4 (requires ffmpeg):
 *    ffmpeg -i scripts/demo-recordings/<slug>.webm \
 *           -c:v libx264 -pix_fmt yuv420p scripts/demo-recordings/<slug>.mp4
 */

import { chromium } from "@playwright/test";
import { mkdirSync, renameSync, existsSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const RECORD_DIR = join(__dirname, "demo-recordings");
mkdirSync(RECORD_DIR, { recursive: true });

const HEADED = process.env.HEADED === "1";
const T2 = process.env.T2 === "1";  // real-inference mode: drop ?t0=1, bump timeouts

const BASE_URL = "http://127.0.0.1:5173";
const ONBOARDING_PATH = T2 ? "/onboarding-chat" : "/onboarding-chat?t0=1";
const argSlug = process.argv[2];
const COMPANY_ID = argSlug ?? `demo-${Math.floor(Date.now() / 1000).toString(36)}`;

const TYPE_DELAY_MS = 60;   // per-char typing delay → feels natural, not too slow
const READ_SHORT = 1500;    // brief dwell after a card appears
const READ_MEDIUM = 2500;   // longer dwell for "reading" content
const READ_LONG = 3500;     // for cards with lots to scan (connector picker, swarm chart)

// Per-phase wait ceilings. T2 mode runs real inference (Pillar 1 ~60-180s,
// connector ~30-90s, swarm ~30-90s, finalize+imprint ~120-240s); t0=1 mode
// returns deterministic fallbacks instantly. Timeouts must cover the slow
// case or the recording errors out mid-walk.
const WAIT_PILLAR1 = T2 ? 240_000 : 30_000;
const WAIT_CONNECTORS = T2 ? 180_000 : 30_000;
const WAIT_SWARM = T2 ? 180_000 : 30_000;
const WAIT_THEATER = T2 ? 360_000 : 120_000;

const PAPERCLIP_API = "http://127.0.0.1:3100";
const PAPERCLIP_UI = "http://127.0.0.1:5174";

// Wipe any prior state for both the script's COMPANY_ID (in case the
// operator passed one explicitly) AND "ricoma" (the deterministic slug
// the typed welcome input derives — "ricoma.com" → hostname → "ricoma").
async function resetState() {
  const slugs = new Set([COMPANY_ID, "ricoma"]);
  for (const slug of slugs) {
    try {
      await fetch(`${BASE_URL}/api/instance/${encodeURIComponent(slug)}/reset`, { method: "DELETE" });
    } catch { /* fresh slug — nothing to reset */ }
  }
}

// Wipe all wavex-os companies from Paperclip so the dashboard is clean
// for the recording. Only touches companies whose name starts with
// "wavex-os/" — leaves any other Paperclip data alone.
async function resetPaperclip() {
  try {
    const r = await fetch(`${PAPERCLIP_API}/api/companies`);
    if (!r.ok) return;
    const companies = await r.json();
    const wavexOnes = companies.filter((c) => typeof c.name === "string" && c.name.startsWith("wavex-os/"));
    for (const c of wavexOnes) {
      await fetch(`${PAPERCLIP_API}/api/companies/${c.id}`, { method: "DELETE" }).catch(() => {});
    }
    if (wavexOnes.length > 0) console.log(`    Cleaned ${wavexOnes.length} prior wavex-os company(s) from Paperclip`);
  } catch { /* Paperclip not running — handoff will report disabled */ }
}

async function main() {
  console.log(`\n🎬  Demo walk recording for ${COMPANY_ID}`);
  console.log(`    Mode: ${HEADED ? "headed (visible)" : "hidden (recording only)"}`);
  console.log(`    Inference: ${T2 ? "REAL T2 (no ?t0=1)" : "fast (t0=1 fallback)"}`);
  console.log(`    Output: ${RECORD_DIR}/${COMPANY_ID}.webm`);
  console.log(`    Target runtime: ~${T2 ? "8–12 min" : "4:00–4:30"}.\n`);

  await resetState();
  await resetPaperclip();

  const browser = await chromium.launch({
    headless: !HEADED,
    args: [
      "--window-size=1440,900",
      "--disable-features=Translate,IsolateOrigins,site-per-process",
      "--disable-background-timer-throttling",
      "--disable-renderer-backgrounding",
    ],
  });
  browser.on("disconnected", () => {
    console.log("  ⚠  Browser disconnected unexpectedly.");
  });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
    // Record the entire session to disk. Playwright writes a .webm to
    // recordVideo.dir keyed by an internal UUID; we rename it to a
    // predictable path after context.close() flushes the file.
    recordVideo: {
      dir: RECORD_DIR,
      size: { width: 1440, height: 900 },
    },
  });
  const page = await context.newPage();
  page.on("crash", () => {
    console.log("  ⚠  Page crashed.");
  });
  page.on("pageerror", (err) => {
    console.log(`  ⚠  Page JS error: ${err.message}`);
  });
  page.on("close", () => {
    console.log("  ⚠  Page closed.");
  });

  const startedAt = Date.now();
  const stage = (label) => {
    const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1);
    console.log(`  [${elapsed.padStart(5)}s] ${label}`);
  };

  // ── Empty state: hero ───────────────────────────────────────────────────
  await page.goto(`${BASE_URL}${ONBOARDING_PATH}`);
  await page.waitForLoadState("networkidle");
  stage("Hero loaded — 5s buffer for you to hit Loom record");
  await page.waitForTimeout(5000);

  // Type input at human speed.
  const input = page.getByPlaceholder(/Ask anything/i);
  await input.click();
  await input.type("ricoma.com — I need marketing and sales help", { delay: TYPE_DELAY_MS });
  await page.waitForTimeout(800);
  await input.press("Enter");
  stage("Submitted welcome input");

  // The shell derives the actual slug from the typed input (URL hostname
  // takes precedence over the script's COMPANY_ID). Grab it from the
  // URL after the redirect so the Paperclip handoff link-match at the
  // end finds the right org.
  await page.waitForURL(/companyId=/, { timeout: 15_000 });
  const actualSlug = new URL(page.url()).searchParams.get("companyId") ?? COMPANY_ID;
  stage(`Slug derived: ${actualSlug}`);

  // ── Pillar 1 confirm card ───────────────────────────────────────────────
  const pillar1Continue = page.getByRole("button", { name: /Looks right.*keep going|Update.*continue/i });
  await pillar1Continue.waitFor({ state: "visible", timeout: WAIT_PILLAR1 });
  stage("Pillar 1 confirm card appeared");
  await page.waitForTimeout(READ_LONG); // operator reads inferred signals
  await pillar1Continue.click();
  stage("Pillar 1 confirmed");

  // ── Scope picker (keyword detection pre-selects marketing + sales) ──────
  await page.getByText(/How big should this team be|Tell me how to scope|Sounds like you want/i)
    .waitFor({ state: "visible", timeout: WAIT_PILLAR1 });
  stage("Scope picker appeared — pausing to review chips");
  await page.waitForTimeout(READ_MEDIUM);
  await page.getByRole("button", { name: /^Continue/ }).last().click();
  stage("Scope confirmed (focused: marketing + sales)");

  // ── Pillar 3 (product / stage) ──────────────────────────────────────────
  await page.getByText(/Where are you in the product journey/i)
    .waitFor({ state: "visible", timeout: 15_000 });
  stage("Pillar 3 appeared");
  await page.waitForTimeout(READ_SHORT);
  await page.getByRole("button", { name: /Live with paying customers/i }).click();
  await page.waitForTimeout(800);
  await page.getByRole("button", { name: /\$10k.*100k/i }).click();
  await page.waitForTimeout(READ_SHORT); // baseline preview appears
  await page.getByRole("button", { name: /^Continue/ }).last().click();
  stage("Pillar 3 done");

  // ── Pillar 4 (GTM) ──────────────────────────────────────────────────────
  await page.getByText(/How do leads come in/i)
    .waitFor({ state: "visible", timeout: 15_000 });
  stage("Pillar 4 appeared");
  await page.waitForTimeout(READ_SHORT);
  await page.getByRole("button", { name: /Inbound ads/i }).click();
  await page.waitForTimeout(500);
  await page.getByRole("button", { name: /Referral/i }).click();
  await page.waitForTimeout(800);
  await page.getByRole("button", { name: /Assisted.*demo required/i }).click();
  await page.waitForTimeout(800);
  await page.getByRole("button", { name: /Mostly phone/i }).click();
  await page.waitForTimeout(READ_SHORT); // GTM profile preview appears
  await page.getByRole("button", { name: /^Continue/ }).last().click();
  stage("Pillar 4 done");

  // ── Pillar 5 (Board comms) ──────────────────────────────────────────────
  await page.getByText(/How do you want your board to talk to you/i)
    .waitFor({ state: "visible", timeout: 15_000 });
  stage("Pillar 5 appeared");
  await page.waitForTimeout(READ_SHORT);
  await page.getByRole("button", { name: /^Slack$/i }).click();
  await page.waitForTimeout(700);
  await page.getByRole("button", { name: /Daily digest/i }).click();
  await page.waitForTimeout(800);
  await page.getByRole("button", { name: /^Continue/ }).last().click();
  stage("Pillar 5 done — connectors loading");

  // ── Connector picker ───────────────────────────────────────────────────
  const connectorContinue = page.getByRole("button", { name: /These look right.*plug them in/i });
  await connectorContinue.waitFor({ state: "visible", timeout: WAIT_CONNECTORS });
  stage("Connector picker appeared");
  await page.waitForTimeout(READ_LONG); // operator scans the buckets
  await connectorContinue.click();
  stage("Connectors confirmed");

  // ── Credential drawer (skip all) ───────────────────────────────────────
  await page.getByRole("heading", { name: /Credentials/i })
    .waitFor({ state: "visible", timeout: 10_000 });
  stage("Credentials drawer appeared");
  await page.waitForTimeout(READ_MEDIUM);
  // Use "Skip all" if available — saves a lot of clicks for the recording.
  const skipAll = page.getByRole("button", { name: /Skip all \(\d+\)/ });
  if (await skipAll.isVisible().catch(() => false)) {
    await skipAll.click();
    stage("Clicked Skip all");
    await page.waitForTimeout(1200);
  } else {
    // Fallback: skip each individually
    let safety = 15;
    while (safety-- > 0) {
      const skip = page.getByRole("button", { name: /^Skip$/ }).first();
      if (!(await skip.isVisible().catch(() => false))) break;
      await skip.click();
      await page.waitForTimeout(200);
      await page.getByRole("button", { name: /Confirm skip/i }).first().click();
      await page.waitForTimeout(300);
    }
  }
  await page.waitForTimeout(800);
  await page.getByRole("button", { name: /Done.*continue to swarm/i }).click();
  stage("Credentials done");

  // ── Swarm Studio ───────────────────────────────────────────────────────
  const swarmConfirm = page.getByRole("button", { name: /These look right.*wire them up/i });
  await swarmConfirm.waitFor({ state: "visible", timeout: WAIT_SWARM });
  stage("Swarm Studio appeared — pausing to admire the org chart");
  await page.waitForTimeout(READ_LONG + 1000); // big visual moment, give it time
  await swarmConfirm.click();
  stage("Swarm confirmed — Theater starting");

  // ── Imprint Theater ────────────────────────────────────────────────────
  const launch = page.getByRole("button", { name: /Let's launch/i });
  await launch.waitFor({ state: "visible", timeout: WAIT_THEATER });
  stage("Theater Act 3 reached — waiting for stream + min act timings");
  // Acts 1-3 already enforce min display times (8s + 3s + stream duration).
  // Just wait for the launch button to enable.
  // Note: waitForFunction signature is (fn, arg, options). Options must be
  // the third positional or the timeout silently falls back to 30s.
  await page.waitForFunction(
    () => {
      const btns = Array.from(document.querySelectorAll("button"));
      const b = btns.find((el) => /Let's launch/i.test(el.textContent ?? ""));
      return b && !b.disabled;
    },
    undefined,
    { timeout: WAIT_THEATER },
  );
  stage("Launch enabled");
  await page.waitForTimeout(READ_MEDIUM); // operator reads imprint
  await launch.click();
  stage("Launched → pricing dialog");

  // ── Pricing dialog (skip for the demo) ─────────────────────────────────
  await page.getByRole("heading", { name: /System Optimizer subscription/i })
    .waitFor({ state: "visible", timeout: 10_000 });
  stage("Pricing dialog visible");
  await page.waitForTimeout(READ_MEDIUM); // operator reads tiers
  await page.getByRole("button", { name: /Skip.*continue without subscription/i }).click();
  stage("Pricing skipped → activate");

  // ── Activate progress ─────────────────────────────────────────────────
  const openMC = page.getByRole("button", { name: /Open Mission Control/i });
  await openMC.waitFor({ state: "visible", timeout: 60_000 });
  stage("Activate complete — Paperclip handoff finished");
  await page.waitForTimeout(2500); // operator reads the active/parked breakdown

  // ── Paperclip handoff (final frame) ───────────────────────────────────
  // Navigate the recording page directly to Paperclip UI. In the real
  // operator flow, clicking "Open Mission Control" opens Paperclip in a
  // new tab — but Playwright records one page, so we navigate the
  // recorded page over to Paperclip to capture the final-state view.
  stage(`Navigating to Paperclip UI to show the mirrored org`);
  await page.goto(PAPERCLIP_UI);
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.waitForTimeout(2000);

  // If Paperclip shows a company list, click into our new org so the
  // recording ends INSIDE the actual org view, not the company picker.
  // Use the actual slug derived from the typed input (not the script's
  // COMPANY_ID which gets overridden by URL-hostname extraction).
  const candidates = [
    page.getByText(new RegExp(`wavex-os/${actualSlug}`, "i")).first(),
    page.getByText(/wavex-os\//i).first(),
  ];
  let clicked = false;
  for (const c of candidates) {
    if (await c.isVisible({ timeout: 3000 }).catch(() => false)) {
      await c.click().catch(() => {});
      await page.waitForLoadState("networkidle").catch(() => {});
      stage(`Opened wavex-os/${actualSlug} in Paperclip`);
      clicked = true;
      break;
    }
  }
  if (!clicked) stage("Paperclip dashboard loaded (no company link matched)");

  // Linger on Paperclip view as the final demo frame.
  await page.waitForTimeout(5000);
  const finalElapsed = ((Date.now() - startedAt) / 1000).toFixed(1);
  console.log(`\n✓  Walk complete in ${finalElapsed}s. Flushing video…`);

  // Capture the video path BEFORE closing — page.video() returns the
  // VideoRecorder object, which becomes invalid after page closes.
  const video = page.video();
  await context.close();
  await browser.close();

  // Playwright writes the video on context.close() with a uuid filename.
  // Rename to our predictable <slug>.webm path.
  if (video) {
    const generatedPath = await video.path().catch(() => null);
    if (generatedPath) {
      const target = join(RECORD_DIR, `${COMPANY_ID}.webm`);
      try {
        renameSync(generatedPath, target);
        console.log(`✓  Saved: ${target}`);
        console.log(`   Convert to mp4: ffmpeg -i "${target}" -c:v libx264 -pix_fmt yuv420p "${target.replace(/\.webm$/, ".mp4")}"`);
      } catch (e) {
        console.log(`⚠  Could not rename video (left at ${generatedPath}): ${e.message}`);
      }
    } else {
      // Fallback: find the most recent .webm in RECORD_DIR
      const files = readdirSync(RECORD_DIR)
        .filter((f) => f.endsWith(".webm") && !f.startsWith(COMPANY_ID))
        .map((f) => ({ name: f, mtime: existsSync(join(RECORD_DIR, f)) ? Date.now() : 0 }))
        .sort((a, b) => b.mtime - a.mtime);
      if (files[0]) {
        const target = join(RECORD_DIR, `${COMPANY_ID}.webm`);
        try {
          renameSync(join(RECORD_DIR, files[0].name), target);
          console.log(`✓  Saved: ${target}`);
        } catch { /* leave as-is */ }
      }
    }
  }
  console.log("");
}

main().catch((e) => {
  // Browser close is a normal exit path — operator may have closed the
  // window after starting/stopping recording. Don't report as failure.
  const msg = String(e?.message ?? e);
  if (/Target page, context or browser has been closed/i.test(msg)) {
    console.log("\n✓  Browser closed by operator. Demo walk ended.\n");
    process.exit(0);
  }
  console.error("\n✗  Demo walk failed:", e);
  process.exit(1);
});
