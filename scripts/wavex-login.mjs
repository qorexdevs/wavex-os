#!/usr/bin/env node
/**
 * `wavex-os login` — compatibility shim.
 *
 * The real device-pairing CLI now lives in the @wavex-os/cloud-client
 * package (`packages/cloud-client/src/cli.ts`), exposed as the `wavex-os`
 * bin (`packages/cloud-client/bin/wavex-os.mjs`). That bin is what
 * `install.sh` / `install.ps1` put on PATH, so the canonical command is:
 *
 *     wavex-os login
 *
 * This script is kept so the existing `pnpm wavex:login` package script
 * and any docs / muscle memory pointing at `node scripts/wavex-login.mjs`
 * keep working — it just forwards to the cloud-client bin with the
 * `login` subcommand.
 *
 * Exit codes are passed through from the underlying CLI:
 *   0 — paired successfully
 *   2 — pairing code expired
 *   3 — network / cloud-side error
 */
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url)); // scripts/
const bin = join(here, "..", "packages", "cloud-client", "bin", "wavex-os.mjs");

const result = spawnSync(process.execPath, [bin, "login", ...process.argv.slice(2)], {
  stdio: "inherit",
});
process.exit(result.status ?? 0);
