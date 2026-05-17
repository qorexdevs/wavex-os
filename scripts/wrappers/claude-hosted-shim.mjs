#!/usr/bin/env node
/**
 * wavex-os hosted-inference shim — bridges tier-router's `claude -p <prompt>`
 * subprocess contract to the Mac mini's inference-server `/v1/onboarding/t2`
 * Pool A endpoint.
 *
 * Argv contract (matches what tier-router's invokeClaudeCode passes):
 *   claude -p "<prompt>" [--output-format json]
 *
 * Stdout contract:
 *   text mode:  raw text response (what claude --print emits)
 *   json mode:  { result: "<text>", usage: {...}, total_cost_usd: 0 }
 *
 * Env:
 *   WAVEX_INFERENCE_HUB_URL  — required (e.g. https://catalogue-sea-such-manchester.trycloudflare.com)
 *   WAVEX_INFERENCE_INSTALL_ID  — optional (defaults to a per-install random id)
 *   WAVEX_INFERENCE_EMAIL    — optional (defaults to "anon@wavex-os.local")
 *   WAVEX_INFERENCE_MODEL    — optional (overrides the model)
 *   WAVEX_INFERENCE_VERBOSE=1 prints diagnostic stderr lines.
 *
 * Failure modes:
 *   Anything wrong → non-zero exit + brief stderr message. tier-router
 *   catches that and surfaces as a T2 failure; the wizard already handles
 *   that path (falls back to deterministic T1 stubs).
 */
import { readFileSync, existsSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import { randomBytes } from "node:crypto";

const args = process.argv.slice(2);

// Short-circuit `--version` so anything that probes the binary identity
// (wavex-os's probeClaudeCode, doctor scripts, etc.) doesn't see a failure
// when the hub-shim is wired in. Mirrors `claude --version`'s exit shape.
if (args.includes("--version") || args.includes("-v")) {
  process.stdout.write("wavex-os hosted-shim 0.1.0 (Pool A relay)\n");
  process.exit(0);
}

let prompt = null;
let outputFormat = "text";
for (let i = 0; i < args.length; i++) {
  if (args[i] === "-p" || args[i] === "--print") {
    prompt = args[i + 1];
    i++;
  } else if (args[i] === "--output-format") {
    outputFormat = args[i + 1];
    i++;
  }
}

if (!prompt) {
  // Some callers pipe the prompt via stdin instead of -p.
  prompt = readStdinSync();
}
if (!prompt) {
  console.error("claude-hosted-shim: no prompt provided (neither -p nor stdin)");
  process.exit(64);
}

const hubUrl = (process.env.WAVEX_INFERENCE_HUB_URL ?? "").replace(/\/+$/, "");
if (!hubUrl) {
  console.error("claude-hosted-shim: WAVEX_INFERENCE_HUB_URL not set");
  process.exit(78);
}

const verbose = process.env.WAVEX_INFERENCE_VERBOSE === "1";
const log = (msg) => verbose && console.error(`[claude-hosted-shim] ${msg}`);

const installId = process.env.WAVEX_INFERENCE_INSTALL_ID ?? loadOrMintInstallId();
const email = process.env.WAVEX_INFERENCE_EMAIL ?? "anon@wavex-os.local";
const model = process.env.WAVEX_INFERENCE_MODEL ?? "claude-sonnet-4-5";

// ── inference-status: heartbeat so the UI's T2ProgressIndicator gets a live
//    elapsed counter instead of freezing on a stale file from a prior run.
//    The route reads ~/.wavex-os/state/inference-current.json (see
//    packages/wavex-os-server/src/routes/inference-status.ts).
const STATUS_PATH = join(homedir(), ".wavex-os", "state", "inference-current.json");
const startedAtMs = Date.now();
function writeStatus(patch) {
  try {
    mkdirSync(join(homedir(), ".wavex-os", "state"), { recursive: true });
    const now = Date.now();
    const base = {
      started_at_ms: startedAtMs,
      pid: process.pid,
      alive: true,
      elapsed_ms: now - startedAtMs,
      completed: false,
      updated_at_ms: now,
    };
    writeFileSync(STATUS_PATH, JSON.stringify({ ...base, ...patch }, null, 2));
  } catch { /* status writes are best-effort; never break the inference call */ }
}
writeStatus({});
// Heartbeat while the call is in flight — UI polls every 1.5s, so 1s tick
// gives a smooth elapsed counter. Cleared in finally{} after the hub returns.
const heartbeat = setInterval(() => writeStatus({}), 1000);

try {
  log(`hub: ${hubUrl}`);
  log(`install_id: ${installId.slice(0, 8)}...`);

  // 1. session token
  const sessionResp = await fetch(`${hubUrl}/v1/onboarding/session`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, install_id: installId }),
  });
  if (!sessionResp.ok) {
    const body = await sessionResp.text();
    throw new Error(`session ${sessionResp.status}: ${body.slice(0, 200)}`);
  }
  const { token } = await sessionResp.json();

  // 2. T2 enrichment
  log("calling /v1/onboarding/t2...");
  const t2Resp = await fetch(`${hubUrl}/v1/onboarding/t2`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ prompt, model, max_output_tokens: 4000 }),
  });
  if (!t2Resp.ok) {
    const body = await t2Resp.text();
    throw new Error(`t2 ${t2Resp.status}: ${body.slice(0, 200)}`);
  }
  const t2 = await t2Resp.json();

  if (outputFormat === "json") {
    // Match claude --output-format json shape
    process.stdout.write(JSON.stringify({
      result: t2.content,
      usage: {
        input_tokens: t2.usage?.input_tokens ?? 0,
        output_tokens: t2.usage?.output_tokens ?? 0,
        cache_read_input_tokens: t2.usage?.cache_read_input_tokens ?? 0,
      },
      total_cost_usd: 0,  // OAuth-Max is flat-rate, not metered
      billing_type: "wavex_os_pool_a",
    }));
  } else {
    process.stdout.write(t2.content ?? "");
  }
  clearInterval(heartbeat);
  writeStatus({ alive: false, completed: true, exit_code: 0 });
} catch (err) {
  clearInterval(heartbeat);
  writeStatus({ alive: false, completed: true, exit_code: 70 });
  console.error(`claude-hosted-shim: ${err.message ?? err}`);
  process.exit(70);
}

// ── helpers ──────────────────────────────────────────────────────────────

function loadOrMintInstallId() {
  const dir = join(homedir(), ".wavex-os");
  const path = join(dir, "install.json");
  if (existsSync(path)) {
    try {
      return JSON.parse(readFileSync(path, "utf8")).install_id;
    } catch { /* fall through to mint */ }
  }
  mkdirSync(dir, { recursive: true });
  const id = randomBytes(16).toString("hex");
  writeFileSync(path, JSON.stringify({ install_id: id, created_at: new Date().toISOString() }, null, 2), { mode: 0o600 });
  return id;
}

function readStdinSync() {
  // tier-router doesn't pipe stdin in current paths; safe-guard for future.
  try {
    return readFileSync(0, "utf8").trim();
  } catch {
    return null;
  }
}
