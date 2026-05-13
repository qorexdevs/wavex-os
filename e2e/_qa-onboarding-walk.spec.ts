/**
 * Full onboarding walk QA spec — v2.
 * Handles "Start →" + draft reset + chat-first flow + records all network.
 */
import { test, type Page } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const SHOT_DIR = "/tmp/qa-shots";
mkdirSync(SHOT_DIR, { recursive: true });

const issues: Array<{ phase: string; kind: string; detail: string; ts: string }> = [];
const networkLog: Array<{ ts: string; method: string; url: string; status?: number }> = [];

function note(phase: string, kind: string, detail: string) {
  issues.push({ phase, kind, detail, ts: new Date().toISOString() });
  // eslint-disable-next-line no-console
  console.log(`[${phase}] ${kind} :: ${detail.slice(0, 200)}`);
}
async function shot(page: Page, name: string) {
  await page.screenshot({ path: join(SHOT_DIR, `${name}.png`), fullPage: true });
}

test.setTimeout(20 * 60 * 1000);

test("wizard E2E walk in hosted mode v2", async ({ page }) => {
  page.on("pageerror", (e) => note("global", "pageerror", String(e)));
  page.on("console", (msg) => {
    if (msg.type() === "error") note("global", "console.error", msg.text());
  });
  page.on("requestfailed", (req) =>
    note("global", "network.failed", `${req.method()} ${req.url()} :: ${req.failure()?.errorText}`),
  );
  page.on("response", async (resp) => {
    const url = resp.url();
    if (/op-omega|composio|connectors|inference|claude-code-check/.test(url)) {
      networkLog.push({
        ts: new Date().toISOString(),
        method: resp.request().method(),
        url: url.replace("http://127.0.0.1:3101", ""),
        status: resp.status(),
      });
    }
  });

  await page.goto("http://127.0.0.1:5173/onboarding", { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => null);
  await shot(page, "01_landing");

  const resetBtn = page.locator("button").filter({ hasText: /^reset$/i }).first();
  if (await resetBtn.isVisible().catch(() => false)) {
    await resetBtn.click();
    // Confirmation modal: "Reset only" | "Reset + restart →"
    const modalConfirm = page.locator("button:visible").filter({ hasText: /reset \+ restart|reset only/i }).first();
    if (await modalConfirm.isVisible({ timeout: 3000 }).catch(() => false)) {
      // Click "Reset + restart" to land on Pillar 1 immediately
      const restart = page.locator("button:visible").filter({ hasText: /reset \+ restart/i }).first();
      if (await restart.isVisible().catch(() => false)) {
        await restart.click();
        note("setup", "reset_restart", "clicked 'Reset + restart' in confirm modal");
      } else {
        await modalConfirm.click();
        note("setup", "reset_only", "clicked first reset confirm in modal");
      }
      await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => null);
    } else {
      note("setup", "reset", "reset button clicked, no modal");
    }
    await page.waitForTimeout(800);
    await shot(page, "02_after_reset");
  }

  // Fill EVERY visible empty text input + textarea (Pillar 1 chat-first now has 2 fields:
  // company name + URL/short-pitch). Heuristic the placeholder for sensible defaults.
  async function fillAllEmpty(): Promise<number> {
    let filled = 0;
    const inputs = await page.locator("input[type='text']:visible, textarea:visible").all();
    for (const inp of inputs) {
      const cur = await inp.inputValue();
      if (cur) continue;
      const ph = ((await inp.getAttribute("placeholder")) ?? "").toLowerCase();
      let val = `QA Test ${Date.now()}`;
      if (/email/.test(ph)) val = "qa@wavex-test.local";
      else if (/url|website|domain|github|acme\.com|short pitch|repo/.test(ph)) val = "https://example.com";
      else if (/context|describe|tell|paste|raw|background/.test(ph)) {
        val = "Two-founder prototype-stage SaaS for AI-assisted code review. " +
          "No revenue yet. Goal: first paying customer in 90 days. " +
          "Stack: TypeScript + Postgres + Anthropic API.";
      }
      await inp.fill(val).catch(() => null);
      filled++;
    }
    return filled;
  }
  const filledCount = await fillAllEmpty();
  note("pillar_1", "filled_inputs", `${filledCount} fields`);
  await shot(page, "03_pillar_1_filled");

  const startBtn = page.locator("button:visible").filter({ hasText: /start|next|→/i }).filter({ hasNotText: /reset|back|cancel/i }).first();
  if (await startBtn.isVisible().catch(() => false)) {
    // Wait up to 5s for it to become enabled (form validation finishes async)
    for (let t = 0; t < 10 && !(await startBtn.isEnabled()); t++) await page.waitForTimeout(500);
    if (await startBtn.isEnabled()) {
      const label = (await startBtn.textContent())?.trim() ?? "";
      await startBtn.click();
      note("pillar_1", "advance_clicked", `"${label}"`);
      await page.waitForLoadState("networkidle", { timeout: 60_000 }).catch(() => null);
      await page.waitForTimeout(2000);
      await shot(page, "04_after_start");
    } else {
      note("pillar_1", "advance_disabled", "button stayed disabled after fills");
      await shot(page, "04_blocked");
    }
  } else {
    note("pillar_1", "no_advance", "Start/Next button missing");
  }

  for (let step = 1; step <= 25; step++) {
    note(`step_${step}`, "url", page.url());

    // Fill any visible empty text inputs / textareas
    const blanks = await page.locator("input[type='text']:visible, textarea:visible").all();
    for (const inp of blanks) {
      const val = await inp.inputValue();
      if (val) continue;
      const placeholder = ((await inp.getAttribute("placeholder")) ?? "").toLowerCase();
      let v = "QA filler";
      if (/email/.test(placeholder)) v = "qa@wavex-test.local";
      else if (/url|website|domain/.test(placeholder)) v = "https://example.com";
      else if (/context|describe|tell|paste|raw|background/.test(placeholder)) {
        v = "Two-founder prototype-stage SaaS for AI-assisted code review. " +
          "No revenue yet. Goal: first paying customer in 90 days. " +
          "Stack: TypeScript + Postgres + Anthropic API.";
      }
      await inp.fill(v).catch(() => null);
    }

    // Pick first radio per group if nothing checked
    const radios = await page.locator("input[type='radio']:visible:not(:checked)").all();
    const seenGroups = new Set<string>();
    for (const r of radios) {
      const n = await r.getAttribute("name");
      if (!n || seenGroups.has(n)) continue;
      seenGroups.add(n);
      await r.check({ force: true }).catch(() => null);
    }

    await shot(page, `step_${String(step).padStart(2, "0")}_a_filled`);

    const nextBtn = page.locator("button:visible").filter({
      hasText: /continue|next|submit|generate|materialize|activate|→|verify|confirm|proceed/i,
    }).filter({ hasNotText: /reset|back|cancel|skip/i }).first();

    const visible = await nextBtn.isVisible({ timeout: 4000 }).catch(() => false);
    if (!visible) {
      note(`step_${step}`, "halt", "no advance button visible");
      await shot(page, `step_${String(step).padStart(2, "0")}_z_halt`);
      break;
    }

    if (!(await nextBtn.isEnabled())) {
      await page.waitForTimeout(1500);
      if (!(await nextBtn.isEnabled())) {
        const label = (await nextBtn.textContent())?.trim() ?? "";
        note(`step_${step}`, "blocked", `"${label}" disabled`);
        await shot(page, `step_${String(step).padStart(2, "0")}_y_blocked`);
        break;
      }
    }

    const label = (await nextBtn.textContent())?.trim() ?? "";
    const t0 = Date.now();
    await nextBtn.click();
    await page.waitForLoadState("networkidle", { timeout: 90_000 }).catch(() => null);
    note(`step_${step}`, "advanced", `"${label}" took ${Date.now() - t0}ms`);
    await page.waitForTimeout(1500);

    const errMarker = page.locator("text=/HTTP [45][0-9]{2}|✗|error during|failed to|denied|forbidden/i").first();
    if (await errMarker.isVisible({ timeout: 1000 }).catch(() => false)) {
      const txt = (await errMarker.textContent())?.trim() ?? "";
      note(`step_${step}`, "error_marker", txt.slice(0, 200));
      await shot(page, `step_${String(step).padStart(2, "0")}_x_error`);
    }
  }

  await shot(page, "99_final");

  writeFileSync(`${SHOT_DIR}/issues.json`, JSON.stringify(issues, null, 2));
  writeFileSync(`${SHOT_DIR}/network.json`, JSON.stringify(networkLog, null, 2));

  // eslint-disable-next-line no-console
  console.log(`\n=== ISSUES (${issues.length}) ===`);
  for (const i of issues) console.log(`  [${i.phase}] ${i.kind}: ${i.detail.slice(0, 160)}`);
  console.log(`\n=== NETWORK (${networkLog.length}) ===`);
  for (const n of networkLog) console.log(`  ${n.method} ${n.url} → ${n.status}`);
});
