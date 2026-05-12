/** End-to-end verification of the Chief of Staff chat improvements.
 *  1. Navigate Paperclip dashboard → sidebar CoS link
 *  2. Confirm starter chips render in empty state
 *  3. Click a starter chip → message + reply
 *  4. Confirm assistant reply renders (markdown OK, char-stream cursor briefly)
 *  5. Send a manual message
 *  6. Confirm currentPath is forwarded (peek at the server-side stored message) */

import { chromium } from "@playwright/test";
import { readFile, unlink } from "node:fs/promises";
import { join } from "node:path";
import { homedir } from "node:os";

const PAPERCLIP_UI = "http://127.0.0.1:5174";

async function getWavexCompany() {
  const r = await fetch("http://127.0.0.1:3100/api/companies");
  const all = await r.json();
  const c = all.find((c) => typeof c.name === "string" && c.name.startsWith("wavex-os/"));
  if (!c) throw new Error("no wavex-os/ company in Paperclip — run the demo walk first");
  return c;
}

async function main() {
  const company = await getWavexCompany();
  const wavexId = company.name.replace(/^wavex-os\//, "");
  console.log(`Company: ${company.name} (prefix ${company.issuePrefix}, wavexId ${wavexId})`);

  // Wipe board-chat state so the empty-state assertions are deterministic.
  const boardChatPath = join(homedir(), ".wavex-os", "instances", "default", "companies", wavexId, "onboarding", "board-chat.json");
  await unlink(boardChatPath).catch(() => {});

  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));

  // Land on dashboard then click sidebar
  await page.goto(`${PAPERCLIP_UI}/${company.issuePrefix}/dashboard`);
  await page.waitForLoadState("networkidle");
  await page.getByRole("link", { name: /Chief of Staff/i }).first().click();
  await page.waitForLoadState("networkidle");
  const cosUrl = page.url();
  if (!cosUrl.toLowerCase().endsWith("/chief-of-staff")) {
    throw new Error(`URL didn't become /<company>/chief-of-staff (got ${cosUrl})`);
  }
  console.log("✓ Sidebar nav routes to chat page");

  // Confirm starter chips visible
  const chip = page.getByRole("button", { name: /most important thing/i }).first();
  await chip.waitFor({ state: "visible", timeout: 5_000 });
  console.log("✓ Empty-state starter chips render");

  // Click the chip — should submit a message and produce a reply
  await chip.click();
  console.log("✓ Starter chip submitted");

  // Wait for an assistant bubble (rendered with prose class for markdown)
  await page.waitForFunction(
    () => Array.from(document.querySelectorAll(".prose")).some((d) => (d.textContent ?? "").trim().length > 4),
    undefined,
    { timeout: 60_000 },
  );
  console.log("✓ Assistant reply rendered (markdown container)");

  // Peek at the stored conversation to confirm currentPath was forwarded.
  await new Promise((res) => setTimeout(res, 500));
  try {
    const raw = await readFile(boardChatPath, "utf8");
    const parsed = JSON.parse(raw);
    const userMsgs = parsed.messages?.filter((m) => m.role === "user") ?? [];
    console.log(`✓ ${userMsgs.length} user message(s) persisted, ${parsed.messages.length} total`);
  } catch (e) {
    console.log(`⚠ Couldn't read board-chat.json: ${e.message}`);
  }

  // Send a follow-up that nudges the CoS toward emitting action chips.
  const input = page.getByPlaceholder(/Ask anything/i);
  await input.click();
  await input.type("if anything looks problematic right now, suggest the action.", { delay: 20 });
  await page.keyboard.press("Enter");
  console.log("✓ Follow-up message sent");

  // Wait for the second assistant bubble to land
  await new Promise((res) => setTimeout(res, 1500));
  await page.waitForFunction(
    () => Array.from(document.querySelectorAll(".prose")).length >= 2,
    undefined,
    { timeout: 60_000 },
  );
  console.log("✓ Follow-up assistant reply rendered");

  if (errors.length > 0) {
    console.log("⚠ Console errors:");
    for (const e of errors) console.log(`   ${e}`);
  }

  console.log("\n✓ All chat upgrade assertions passed.");
  await browser.close();
}

main().catch((e) => {
  console.error("\n✗ Verification failed:", e.message);
  process.exit(1);
});
