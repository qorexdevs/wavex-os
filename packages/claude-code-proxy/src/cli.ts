/**
 * TypeScript CLI entrypoint. Runs as TS source via `node --import tsx`.
 * The .mjs bin shim spawns this through tsx so we can import cloud-client
 * directly from its TS source (matches wavex-os-server's pattern).
 */
import { startProxy } from "./index.js";

const args = process.argv.slice(2);
const portArg = args.indexOf("--port");
const port = portArg >= 0 ? Number(args[portArg + 1]) : undefined;

try {
  const { url } = await startProxy({ port });
  // eslint-disable-next-line no-console
  console.log(`[wavex-os-proxy] listening on ${url}`);
  console.log(`[wavex-os-proxy] point Claude Code at it:`);
  console.log(`  ANTHROPIC_BASE_URL=${url} claude`);
} catch (err) {
  // eslint-disable-next-line no-console
  console.error(`[wavex-os-proxy] failed to start:`, err);
  process.exit(1);
}
