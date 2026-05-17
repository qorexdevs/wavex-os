#!/usr/bin/env node
/**
 * CLI shim for @wavex-os/claude-code-proxy.
 *
 * Re-execs with `node --import tsx` so the TS sources in ../src/ can run
 * directly (cloud-client + auth-shim are workspace-linked TS sources, not
 * pre-built). This matches the op-omega-server pattern of "TS source is
 * the source of truth, no separate build step".
 *
 * Usage:
 *   wavex-os-proxy                              # bind 127.0.0.1:11434
 *   wavex-os-proxy --port 12345                 # custom port
 *   WAVEX_PROXY_PORT=12345 wavex-os-proxy       # env override
 *
 * Once running, set ANTHROPIC_BASE_URL to the proxy URL and run Claude
 * Code as usual:
 *
 *   ANTHROPIC_BASE_URL=http://127.0.0.1:11434 claude
 *
 * The proxy reads the device JWT from ~/.wavex-os/device-token.json —
 * pair the machine with `wavex-os login` once before starting the proxy.
 */
import { spawn } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const cliEntry = join(__dirname, "..", "src", "cli.ts");
const pkgRoot = join(__dirname, "..");

// Re-exec under tsx by setting cwd to the package root — that way Node's
// `--import tsx` resolves the bare specifier from
// packages/claude-code-proxy/node_modules/tsx where pnpm installs it.
const child = spawn(
  process.execPath,
  ["--import", "tsx", cliEntry, ...process.argv.slice(2)],
  {
    stdio: "inherit",
    env: process.env,
    cwd: pkgRoot,
  },
);

child.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  else process.exit(code ?? 0);
});

for (const sig of ["SIGINT", "SIGTERM", "SIGHUP"]) {
  process.on(sig, () => child.kill(sig));
}
