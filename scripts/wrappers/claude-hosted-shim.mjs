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
} catch (err) {
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
