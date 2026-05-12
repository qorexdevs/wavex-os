#!/usr/bin/env node
/**
 * WaveX OS installer.
 *
 * Usage:
 *   npx wavex-os init [company-name]
 *   npx wavex-os doctor
 *   npx wavex-os reset
 *
 * Phase B: this is the scaffolded UX shell. Real installation work lands in
 * Phase C (template materialization, Drizzle migrations, OAuth probe).
 */

import { exec, spawn } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { homedir, platform } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const execAsync = promisify(exec);
const __dirname = dirname(fileURLToPath(import.meta.url));

const c = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  cyan: "\x1b[36m",
  accent: "\x1b[38;5;79m",
};

const HOME_DIR = join(homedir(), ".wavex-os");
const ONBOARDING_PORT = 5173;
const MOCK_CORE_PORT = 3101;

const BANNER = `
${c.accent}  __     __                 __  __    ___  ____
  \\ \\   / /                \\ \\/ /   / _ \\/ ___|
   \\ \\ / /_ ___   _____ ___\\  /   | | | \\___ \\
    \\ V / _\` \\ \\ / / _ \\___ /\\ \\   | |_| |___) |
     \\_/\\__,_|\\_/\\_\\___/   /_/\\_\\   \\___/|____/${c.reset}

  ${c.dim}Open-source AI agent fleet — your localhost, your inference, your data.${c.reset}
`;

interface DoctorResult {
  ok: boolean;
  checks: { name: string; ok: boolean; detail?: string }[];
}

interface RuntimeCheck {
  name: string;
  state: "green" | "yellow" | "red" | "info";
  detail?: string;
}

interface RuntimeResult {
  ok: boolean;
  checks: RuntimeCheck[];
}

async function checkBinary(name: string): Promise<{ ok: boolean; version?: string }> {
  try {
    const { stdout } = await execAsync(`${name} --version`);
    return { ok: true, version: stdout.trim().split("\n")[0] };
  } catch {
    return { ok: false };
  }
}

async function doctor(): Promise<DoctorResult> {
  const checks: DoctorResult["checks"] = [];

  const node = await checkBinary("node");
  checks.push({ name: "node ≥18", ok: node.ok && parseFloat(node.version?.replace("v", "") ?? "0") >= 18, detail: node.version });

  const pnpm = await checkBinary("pnpm");
  checks.push({ name: "pnpm ≥8", ok: pnpm.ok, detail: pnpm.version ?? "not found — install from https://pnpm.io" });

  const git = await checkBinary("git");
  checks.push({ name: "git", ok: git.ok, detail: git.version });

  // Phase C will probe the keychain for Claude Max OAuth token.
  // For now, just check that ~/Library/Keychains/login.keychain-db exists on macOS.
  const isMac = platform() === "darwin";
  if (isMac) {
    const keychainPath = join(homedir(), "Library/Keychains/login.keychain-db");
    checks.push({ name: "macOS keychain", ok: existsSync(keychainPath), detail: existsSync(keychainPath) ? "found" : "missing — Claude Max OAuth requires this on macOS" });
  } else {
    checks.push({ name: "Claude credential storage", ok: true, detail: "Phase C will use platform-appropriate storage on Linux/Windows" });
  }

  const ok = checks.every((c) => c.ok);
  return { ok, checks };
}

function printDoctor(result: DoctorResult): void {
  console.log(`\n${c.bold}Environment check${c.reset}\n`);
  for (const check of result.checks) {
    const mark = check.ok ? `${c.green}✓${c.reset}` : `${c.red}✗${c.reset}`;
    const detail = check.detail ? `${c.dim}${check.detail}${c.reset}` : "";
    console.log(`  ${mark} ${check.name}  ${detail}`);
  }
  console.log();
  if (!result.ok) {
    console.log(`${c.red}Some prerequisites are missing. Fix the items above and re-run.${c.reset}\n`);
  }
}

/** Runtime audit — probes the currently-running stack (Paperclip, mock-core,
 *  inference-server, disk, RAM). Distinct from `doctor` which checks env. */
async function audit(): Promise<RuntimeResult> {
  const checks: RuntimeCheck[] = [];

  // Disk
  try {
    const { stdout } = await execAsync(`df -h / | tail -1`);
    const pct = parseInt(stdout.split(/\s+/).find((s) => s.endsWith("%"))?.replace("%", "") ?? "0", 10);
    const state: RuntimeCheck["state"] = pct >= 90 ? "red" : pct >= 80 ? "yellow" : "green";
    checks.push({ name: "disk usage", state, detail: `${pct}% of root volume` });
  } catch {
    checks.push({ name: "disk usage", state: "info", detail: "could not read df" });
  }

  // RAM pressure (macOS-specific)
  if (platform() === "darwin") {
    try {
      const { stdout } = await execAsync(`sysctl -n vm.swapusage`);
      // "total = 0.00M  used = 0.00M  free = 0.00M  (encrypted)"
      const m = stdout.match(/used\s*=\s*([\d.]+)M/);
      const used = m ? parseFloat(m[1]!) : 0;
      const state: RuntimeCheck["state"] = used > 1000 ? "red" : used > 200 ? "yellow" : "green";
      checks.push({ name: "swap usage", state, detail: `${used.toFixed(1)} MB used` });
    } catch {
      checks.push({ name: "swap usage", state: "info", detail: "sysctl unavailable" });
    }
  }

  // Ports
  const ports = [
    { port: 3100, name: "Paperclip server (3100)" },
    { port: 3101, name: "wavex mock-core (3101)" },
    { port: 5173, name: "wavex onboarding UI (5173)" },
    { port: 8787, name: "wavex inference-server (8787)" },
  ];
  for (const { port, name } of ports) {
    try {
      const { stdout } = await execAsync(`lsof -nP -iTCP:${port} -sTCP:LISTEN 2>/dev/null | tail -n +2 | head -1`);
      if (stdout.trim()) {
        checks.push({ name, state: "green", detail: "listening" });
      } else {
        checks.push({ name, state: "info", detail: "not listening (expected if you haven't started this service)" });
      }
    } catch {
      checks.push({ name, state: "info", detail: "probe failed" });
    }
  }

  // launchd jobs
  try {
    const { stdout } = await execAsync(`launchctl list 2>/dev/null | grep wavex-os || true`);
    const lines = stdout.trim().split("\n").filter(Boolean);
    if (lines.length > 0) {
      checks.push({ name: "wavex-os launchd jobs", state: "green", detail: `${lines.length} loaded` });
    } else {
      checks.push({ name: "wavex-os launchd jobs", state: "info", detail: "none loaded — run `node scripts/render-launchd-templates.mjs` to install" });
    }
  } catch {
    checks.push({ name: "wavex-os launchd jobs", state: "info", detail: "launchctl unavailable" });
  }

  // Paperclip reachability
  try {
    const { stdout } = await execAsync(`curl -sf -o /dev/null -w "%{http_code}" -m 3 http://127.0.0.1:3100/api/health`);
    const code = parseInt(stdout, 10);
    checks.push({ name: "Paperclip /api/health", state: code === 200 ? "green" : "red", detail: `HTTP ${code}` });
  } catch {
    checks.push({ name: "Paperclip /api/health", state: "info", detail: "unreachable" });
  }

  // Inference server reachability (G.3)
  try {
    const { stdout } = await execAsync(`curl -sf -o /dev/null -w "%{http_code}" -m 3 http://127.0.0.1:8787/v1/health`);
    const code = parseInt(stdout, 10);
    checks.push({ name: "wavex-inference-server /v1/health", state: code === 200 ? "green" : "red", detail: `HTTP ${code}` });
  } catch {
    checks.push({ name: "wavex-inference-server /v1/health", state: "info", detail: "unreachable (expected before G.3 deploy)" });
  }

  // Recent log errors (best-effort)
  try {
    const logPath = join(HOME_DIR, "state", "resource-sweep.log");
    if (existsSync(logPath)) {
      const { stdout } = await execAsync(`tail -50 "${logPath}" | grep -E "(RED|ORANGE|error|failed)" | tail -5 || true`);
      if (stdout.trim()) {
        checks.push({ name: "recent resource-sweep alerts", state: "yellow", detail: stdout.trim().split("\n").length + " lines (run `tail -50 ~/.wavex-os/state/resource-sweep.log`)" });
      } else {
        checks.push({ name: "recent resource-sweep alerts", state: "green", detail: "clean window" });
      }
    } else {
      checks.push({ name: "recent resource-sweep alerts", state: "info", detail: "log not found (resource-sweep launchd may not be loaded yet)" });
    }
  } catch {
    checks.push({ name: "recent resource-sweep alerts", state: "info", detail: "log probe failed" });
  }

  const ok = checks.every((c) => c.state !== "red");
  return { ok, checks };
}

function printAudit(result: RuntimeResult): void {
  console.log(`\n${c.bold}Runtime audit${c.reset}\n`);
  for (const check of result.checks) {
    const mark =
      check.state === "green"  ? `${c.green}●${c.reset}` :
      check.state === "yellow" ? `${c.yellow}●${c.reset}` :
      check.state === "red"    ? `${c.red}●${c.reset}` :
                                 `${c.dim}○${c.reset}`;
    const detail = check.detail ? `${c.dim}${check.detail}${c.reset}` : "";
    console.log(`  ${mark} ${check.name.padEnd(40)} ${detail}`);
  }
  console.log();
  if (!result.ok) {
    console.log(`${c.red}One or more checks are RED. See details above.${c.reset}\n`);
  }
}

async function init(rawCompanyName?: string): Promise<void> {
  console.log(BANNER);

  // Step 1: doctor
  const dr = await doctor();
  printDoctor(dr);
  if (!dr.ok) {
    process.exit(1);
  }

  // Step 2: company directory
  const companyName = (rawCompanyName ?? "default").trim().replace(/[^a-zA-Z0-9_-]/g, "-").toLowerCase();
  const companyDir = join(HOME_DIR, "instances", companyName);
  if (!existsSync(companyDir)) {
    mkdirSync(companyDir, { recursive: true });
    console.log(`${c.green}✓${c.reset} Created instance dir: ${c.dim}${companyDir}${c.reset}`);
  } else {
    console.log(`${c.yellow}⚠${c.reset}  Instance ${c.bold}${companyName}${c.reset} already exists at ${c.dim}${companyDir}${c.reset}`);
    console.log(`   Re-running onboarding will preserve existing agents but may overwrite onboarding state.`);
  }

  // Step 3: write a session manifest
  const sessionId = `${companyName}-${Date.now()}`;
  const manifestPath = join(companyDir, "session.json");
  writeFileSync(
    manifestPath,
    JSON.stringify(
      {
        sessionId,
        companyName,
        createdAt: new Date().toISOString(),
        wavexOsVersion: "0.1.0",
        phase: "B",
        status: "onboarding-pending",
      },
      null,
      2,
    ),
  );
  console.log(`${c.green}✓${c.reset} Wrote session manifest: ${c.dim}${manifestPath}${c.reset}`);

  // Step 4: tell the user what's about to happen
  console.log(`
${c.bold}Next:${c.reset} starting the onboarding stack:
  ${c.cyan}http://localhost:${ONBOARDING_PORT}${c.reset}  ${c.dim}— wizard UI (Vite + React)${c.reset}
  ${c.cyan}http://localhost:${MOCK_CORE_PORT}${c.reset}  ${c.dim}— mock Paperclip core (Phase C; Phase D swaps in real)${c.reset}

${c.dim}Phase D will boot the real Paperclip server in place of the mock-core.${c.reset}

Open ${c.bold}${c.cyan}http://localhost:${ONBOARDING_PORT}${c.reset} in your browser when it's ready.
Press ${c.bold}Ctrl-C${c.reset} to stop both servers.
`);

  // Step 5: spawn pnpm dev
  // Resolve the repo root from the installer's location:
  //  - if installed via npx, this lives in node_modules — repo root not available
  //  - if running from a clone, walk up from apps/installer/bin to the workspace
  // For Phase B, default to "find a sibling package.json with workspaces"
  let repoRoot = process.cwd();
  if (existsSync(join(__dirname, "..", "..", "..", "pnpm-workspace.yaml"))) {
    repoRoot = join(__dirname, "..", "..", "..");
  }

  const child = spawn("pnpm", ["dev:full"], {
    cwd: repoRoot,
    stdio: "inherit",
    shell: true,
    env: {
      ...process.env,
      WAVEX_OS_SESSION_ID: sessionId,
      WAVEX_OS_COMPANY_NAME: companyName,
      WAVEX_MOCK_CORE_PORT: String(MOCK_CORE_PORT),
    },
  });

  child.on("exit", (code) => {
    console.log(`\n${c.dim}Onboarding UI exited with code ${code}.${c.reset}`);
    process.exit(code ?? 0);
  });
}

async function reset(): Promise<void> {
  console.log(BANNER);
  console.log(`${c.yellow}This will remove ${c.bold}${HOME_DIR}${c.reset}${c.yellow}.${c.reset}`);
  console.log(`${c.dim}Phase B: stub — full implementation in Phase C.${c.reset}`);
  console.log(`To proceed manually: ${c.bold}rm -rf ${HOME_DIR}${c.reset}\n`);
}

function help(): void {
  console.log(BANNER);
  console.log(`${c.bold}Usage:${c.reset}
  ${c.cyan}npx wavex-os init [company-name]${c.reset}    Bootstrap a new WaveX OS company
  ${c.cyan}npx wavex-os doctor${c.reset}                 Check environment prerequisites
  ${c.cyan}npx wavex-os audit${c.reset}                  Probe the running stack (disk, RAM, ports, services)
  ${c.cyan}npx wavex-os reset${c.reset}                  Remove ${c.dim}~/.wavex-os${c.reset} (destructive)
  ${c.cyan}npx wavex-os --help${c.reset}                 Show this message

${c.bold}Docs:${c.reset} https://github.com/aimerdoux/wavex-os
`);
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const cmd = argv[0];

  if (!cmd || cmd === "--help" || cmd === "-h" || cmd === "help") {
    help();
    return;
  }

  switch (cmd) {
    case "init":
      await init(argv[1]);
      break;
    case "doctor":
      console.log(BANNER);
      printDoctor(await doctor());
      break;
    case "audit":
      console.log(BANNER);
      printAudit(await audit());
      break;
    case "reset":
      await reset();
      break;
    default:
      console.log(`${c.red}Unknown command:${c.reset} ${cmd}\n`);
      help();
      process.exit(1);
  }
}

main().catch((err) => {
  console.error(`${c.red}Error:${c.reset}`, err.message);
  process.exit(1);
});
