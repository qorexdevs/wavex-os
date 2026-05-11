/** Paperclip auto-detection. On wavex server boot, ping a few likely
 *  Paperclip URLs (default port 3100) — if one responds, set
 *  PAPERCLIP_HANDOFF_URL so the handoff bridge picks it up without the
 *  operator having to set the env var manually.
 *
 *  Skipped when the env var is already set explicitly. The detection
 *  call has a hard 1.5s timeout so a missing Paperclip never blocks
 *  wavex boot.
 *
 *  Logged loudly to stderr so the operator sees what happened — either
 *  "→ paperclip auto-detected at http://localhost:3100" or "→ paperclip
 *  not running locally; handoff disabled". */

const PAPERCLIP_DEFAULT_PORTS = [3100, 3000];
const DETECT_TIMEOUT_MS = 1500;

async function pingPaperclip(url: string): Promise<boolean> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DETECT_TIMEOUT_MS);
  try {
    const r = await fetch(`${url}/api/health`, { signal: controller.signal });
    if (!r.ok) return false;
    // Health endpoint returns JSON with at least { status: "..." }; we don't
    // require any specific shape — just that it responds with 2xx JSON.
    await r.json().catch(() => null);
    return true;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

/** Detect a running Paperclip and configure PAPERCLIP_HANDOFF_URL.
 *  Idempotent — safe to call multiple times. Returns the chosen URL or
 *  null. Logs to stderr so the operator sees the outcome at boot. */
export async function detectAndConfigurePaperclip(): Promise<string | null> {
  if (process.env.PAPERCLIP_HANDOFF_URL) {
    // eslint-disable-next-line no-console
    console.error(`[paperclip-detect] PAPERCLIP_HANDOFF_URL already set: ${process.env.PAPERCLIP_HANDOFF_URL}`);
    return process.env.PAPERCLIP_HANDOFF_URL;
  }

  for (const port of PAPERCLIP_DEFAULT_PORTS) {
    const url = `http://127.0.0.1:${port}`;
    if (await pingPaperclip(url)) {
      process.env.PAPERCLIP_HANDOFF_URL = url;
      // eslint-disable-next-line no-console
      console.error(`[paperclip-detect] → paperclip auto-detected at ${url}`);
      return url;
    }
  }

  // eslint-disable-next-line no-console
  console.error(
    "[paperclip-detect] → paperclip not running locally on ports " +
    PAPERCLIP_DEFAULT_PORTS.join(",") +
    "; handoff disabled. Start it with `cd packages/core && pnpm dev:server`.",
  );
  return null;
}
