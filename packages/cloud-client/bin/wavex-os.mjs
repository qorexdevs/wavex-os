#!/usr/bin/env node
/**
 * `wavex-os` bin entrypoint.
 *
 * The CLI logic lives in ../src/cli.ts (typechecked). It is compiled to
 * ../dist/cli.js by the package `build` script (`tsc -p tsconfig.build.json`).
 * Once emitted, every `./index.js`-style specifier in the sources resolves
 * cleanly because the emitted files genuinely ARE `.js` — which is the whole
 * reason the `.js`-specifier-pointing-at-`.ts` convention exists.
 *
 * This launcher is a plain Node ESM shim: import the built CLI and run it.
 * No `tsx`, no loader bootstrap, no re-exec dance.
 *
 *   - workspace checkout:  `pnpm --filter @wavex-os/cloud-client build`
 *   - global install:      the `prepare` script builds on `npm i -g`
 *
 * If `dist/` is missing (e.g. someone runs the bin straight from a fresh
 * checkout before building), we fail with an actionable message rather than
 * a raw `ERR_MODULE_NOT_FOUND`.
 */
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const cliPath = join(__dirname, "..", "dist", "cli.js");

async function main() {
  if (!existsSync(cliPath)) {
    console.error(
      "wavex-os: the CLI is not built yet (missing dist/cli.js).\n" +
        "Build it first:\n" +
        "  (workspace)  pnpm --filter @wavex-os/cloud-client build\n" +
        "  (global)     reinstall: npm i -g @wavex-os/cloud-client",
    );
    process.exit(1);
  }

  const { runCli } = await import(pathToFileURL(cliPath).href);
  const code = await runCli(process.argv.slice(2));
  process.exit(code ?? 0);
}

main().catch((err) => {
  console.error(
    "wavex-os:",
    err instanceof Error ? err.stack || err.message : String(err),
  );
  process.exit(1);
});
