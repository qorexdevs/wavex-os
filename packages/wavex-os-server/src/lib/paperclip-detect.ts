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
    // Hit /api/health AND verify the response contains a Paperclip-specific
    // field. Otherwise we'd false-match wavex's own mock-core (which also
    // serves /api/health on port 3101, and would loop the handoff back to
    // itself if detected — exactly the bug we just hit in dev).
    const r = await fetch(`${url}/api/health`, { signal: controller.signal });
    if (!r.ok) return false;
    const body = await r.json().catch(() => null) as Record<string, unknown> | null;
    if (!body) return false;
    // Paperclip's health response includes serverVersion + deploymentMode
    // (see packages/core/server/src/routes/health.ts). Wavex's mock-core
    // doesn't. Either field discriminates.
    const isPaperclip =
      typeof body.serverVersion === "string" ||
      typeof body.deploymentMode === "string" ||
      typeof body.deploymentExposure === "string";
    return isPaperclip;
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
