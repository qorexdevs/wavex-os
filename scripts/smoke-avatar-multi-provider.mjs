/** Phase 6 multi-provider smoke. Drives every new runtime surface
 *  against an existing finalized avatar in dryRun mode (no Composio
 *  required), then asserts memory v1 captures the operator decisions
 *  and a distill pass produces ≥0 rules.
 *
 *  Runs ~3 real T2 calls (mail / calendar / slack classifiers under
 *  skipInference=false). Outlook + Microsoft Calendar paths are
 *  exercised only if those agent ids exist on the avatar's
 *  paperclip-handoff.json; otherwise that branch is skipped with a
 *  warning so the smoke works on Phase 2-era avatars too. */

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { homedir } from "node:os";

const API = "http://127.0.0.1:3101";
const AVATAR_ROOT = join(homedir(), ".wavex-os", "instances", "default", "avatars");
const AVATAR_ID = process.env.AVATAR_ID ?? "bridge-v2-2e55";

function assert(cond, msg) {
  if (!cond) throw new Error(`✗ ${msg}`);
}

async function readAvatarJson(file) {
  return JSON.parse(await readFile(join(AVATAR_ROOT, AVATAR_ID, file), "utf8"));
}

async function main() {
  console.log(`Phase 6 multi-provider smoke against avatar="${AVATAR_ID}"\n`);

  const handoff = await readAvatarJson("paperclip-handoff.json").catch(() => null);
  assert(handoff, `${AVATAR_ID} missing paperclip-handoff.json — run a fresh onboarding first`);
  const agents = handoff.agents ?? {};

  // 1. Gmail via the new mail-triage route, real T2 classifier
  console.log("· mail-triage/gmail (real T2)…");
  const gmail = await fetch(`${API}/api/avatar/${AVATAR_ID}/run/mail-triage/gmail?skipInference=false`, { method: "POST" }).then((r) => r.json());
  assert(gmail.ok && gmail.result.processed >= 1, `gmail mail-triage failed: ${JSON.stringify(gmail)}`);
  console.log(`  ✓ gmail processed=${gmail.result.processed} drafted=${gmail.result.drafted} queued=${gmail.result.approvalsCreated}`);

  // 2. Outlook via the same generic route — only if the avatar's bridge has an outlook agent
  if (agents.outlook) {
    console.log("· mail-triage/outlook (real T2)…");
    const outlook = await fetch(`${API}/api/avatar/${AVATAR_ID}/run/mail-triage/outlook?skipInference=false`, { method: "POST" }).then((r) => r.json());
    assert(outlook.ok, `outlook mail-triage failed: ${JSON.stringify(outlook)}`);
    console.log(`  ✓ outlook processed=${outlook.result.processed} drafted=${outlook.result.drafted} queued=${outlook.result.approvalsCreated}`);
  } else {
    console.log("· outlook agent absent on this avatar's bridge — skipping outlook mail-triage");
  }

  // 3. Calendar — Google + Microsoft if connected
  console.log("· calendar-triage/google_calendar (real T2)…");
  const gcal = await fetch(`${API}/api/avatar/${AVATAR_ID}/run/calendar-triage/google_calendar?skipInference=false`, { method: "POST" }).then((r) => r.json());
  if (gcal.ok && gcal.result.approvalsCreated >= 1) {
    console.log(`  ✓ google_calendar processed=${gcal.result.processed} queued=${gcal.result.approvalsCreated}`);
  } else {
    console.log(`  · google_calendar skipped (${gcal.result.errors?.[0]?.message ?? "unknown"})`);
  }

  if (agents.microsoft_calendar) {
    console.log("· calendar-triage/microsoft_calendar (real T2)…");
    const mcal = await fetch(`${API}/api/avatar/${AVATAR_ID}/run/calendar-triage/microsoft_calendar?skipInference=false`, { method: "POST" }).then((r) => r.json());
    assert(mcal.ok, `microsoft_calendar failed: ${JSON.stringify(mcal)}`);
    console.log(`  ✓ microsoft_calendar processed=${mcal.result.processed} queued=${mcal.result.approvalsCreated}`);
  } else {
    console.log("· microsoft_calendar agent absent on this avatar's bridge — skipping");
  }

  // 4. Slack mention digest
  console.log("· slack-digest (real T2)…");
  const slack = await fetch(`${API}/api/avatar/${AVATAR_ID}/run/slack-digest?skipInference=false`, { method: "POST" }).then((r) => r.json());
  if (slack.ok && slack.result.approvalsCreated >= 1) {
    console.log(`  ✓ slack processed=${slack.result.processed} queued=${slack.result.approvalsCreated}`);
  } else {
    console.log(`  · slack skipped (${slack.result.errors?.[0]?.message ?? "unknown"})`);
  }

  // 5. Cross-check approvals carry provider chips
  const approvals = await fetch(`${API}/api/avatar/${AVATAR_ID}/approvals?status=pending`).then((r) => r.json());
  const types = new Set(approvals.approvals?.map((a) => a.type) ?? []);
  console.log(`\n✓ approvals queue holds these types: ${[...types].sort().join(", ")}`);
  assert(types.has("avatar.gmail.draft_reply"), "expected gmail draft_reply approvals in the queue");
  assert([...types].some((t) => t.startsWith("avatar.google_calendar.invite_response") || t.startsWith("avatar.microsoft_calendar.invite_response")), "expected at least one calendar invite_response");
  assert([...types].some((t) => t === "avatar.slack.mention_digest"), "expected at least one slack mention_digest");

  // 6. Decide one approval (approve with an edit) to populate episodic memory.
  const target = approvals.approvals.find((a) => a.type === "avatar.gmail.draft_reply" && a.payload.draftText);
  if (target) {
    const editedDraft = `${target.payload.draftText} (no apologies)`;
    const decide = await fetch(`${API}/api/avatar/${AVATAR_ID}/approvals/${target.id}/decide`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ decision: "approve", editedPayload: { draftText: editedDraft }, decisionNote: "trimmed apology" }),
    }).then((r) => r.json());
    assert(decide.ok, `decide failed: ${JSON.stringify(decide)}`);
    console.log(`✓ decided approval ${target.id} with edit`);
  }

  // 7. Read memory — episodic should include the new decision + edit
  const mem = await fetch(`${API}/api/avatar/${AVATAR_ID}/memory?limit=10`).then((r) => r.json());
  console.log(`✓ memory: preferences=${mem.preferences.length} episodic=${mem.episodic.length}`);
  assert(mem.episodic.length >= 1, "expected episodic events to be present");

  // 8. Distill (real T2)
  console.log("· memory distill (real T2; ~5-20s)…");
  const distill = await fetch(`${API}/api/avatar/${AVATAR_ID}/memory/distill`, { method: "POST" }).then((r) => r.json());
  assert(distill.ok, `distill failed: ${JSON.stringify(distill)}`);
  console.log(`  ✓ distill produced ${distill.count} new rule(s)`);
  if (distill.count > 0) {
    for (const r of distill.added) console.log(`    - [${r.category}] ${r.rule}`);
  }

  console.log(`\n✓ Phase 6 multi-provider smoke passed`);
}

main().catch((e) => {
  console.error(`\n✗ ${e.message}`);
  process.exit(1);
});
