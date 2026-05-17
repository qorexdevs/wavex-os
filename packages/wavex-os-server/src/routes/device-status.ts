/** GET /api/inference-status — inference reachability for the BYOC wizard.
 *
 *  Powers the onboarding-ui's "Inference online/offline" chip + the
 *  `isPoolBReachable` gate in `lib/api.ts`. Determines whether the
 *  pillar-suggest button should call Pool B (local `claude` CLI, BYOC)
 *  or fall through to Pool A.
 *
 *  Post-BYOC pivot (2026-05-17): "Pool B" means the customer's OWN
 *  local Claude — NOT the operator's Mac Mini. So inference
 *  reachability is now primarily a function of `claude auth status`
 *  on this machine, NOT the wavex-os device-pairing JWT.
 *
 *  The device-pairing JWT is still useful (manifest sync, subscription
 *  gating, instance_health) but it's no longer the inference gate —
 *  the QA E2E uncovered that customers with valid local claude were
 *  being dead-ended into Pool A failures because their cached cloud
 *  token had expired.
 *
 *  States:
 *    online === true  + mode === "pool_b"    customer can call BYOC claude
 *    online === true  + mode === "pool_a"    falls through to operator hub
 *    online === false + reason === "..."     no inference path available
 *
 *  Backward-compat: still returns user_id + expires_at when a valid
 *  device bundle exists. UI callers that read those fields keep working. */

import type { FastifyInstance } from "fastify";
import { spawn } from "node:child_process";
import { platform } from "node:os";
import { introspectBundle, getValidAccessToken, readBundle } from "@wavex-os/cloud-client";

const IS_WIN = platform() === "win32";
const CLAUDE_STATUS_TIMEOUT_MS = 4000;

interface ClaudeAuthStatus {
  loggedIn: boolean;
  email?: string;
  subscriptionType?: string;
}

/** Run `claude auth status` and parse the JSON. Returns null if claude
 *  isn't on PATH or the call errors / times out. We cache nothing — the
 *  status is cheap (~50ms) and customers expect the chip to reflect
 *  their auth state in near real-time. */
function readClaudeAuthStatus(): Promise<ClaudeAuthStatus | null> {
  return new Promise((resolve) => {
    const bin = IS_WIN ? "claude.cmd" : "claude";
    const child = spawn(bin, ["auth", "status"], { shell: IS_WIN });
    let stdout = "";
    child.stdout?.on("data", (d) => { stdout += d.toString(); });
    const timer = setTimeout(() => {
      try { child.kill("SIGTERM"); } catch { /* ignore */ }
      resolve(null);
    }, CLAUDE_STATUS_TIMEOUT_MS);
    child.on("error", () => { clearTimeout(timer); resolve(null); });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code !== 0) { resolve(null); return; }
      try {
        const parsed = JSON.parse(stdout);
        if (typeof parsed.loggedIn === "boolean") {
          resolve(parsed as ClaudeAuthStatus);
        } else {
          resolve(null);
        }
      } catch {
        resolve(null);
      }
    });
  });
}

/** Best-effort device-token introspection. Used for the user_id +
 *  expires_at fields the UI surfaces in its transparency chip. Never
 *  fail-closed — if this errors, we just don't surface those fields.
 *  Inference gating is decided by claude auth status, separately. */
async function tryReadDeviceBundle(): Promise<{ user_id: string; expires_at: number } | null> {
  try {
    const initial = await introspectBundle();
    if (initial.ok && initial.bundle) {
      return {
        user_id: initial.bundle.user_id,
        expires_at: initial.bundle.access_token_expires_at,
      };
    }
    // Try a single refresh if the token's just expired (no harm — same
    // self-heal as the previous implementation).
    if (initial.reason === "expired" && initial.bundle) {
      try {
        await getValidAccessToken();
        const refreshed = await readBundle();
        if (refreshed) {
          return {
            user_id: refreshed.user_id,
            expires_at: refreshed.access_token_expires_at,
          };
        }
      } catch { /* fall through */ }
    }
    return null;
  } catch {
    return null;
  }
}

export function registerDeviceStatusRoute(app: FastifyInstance): void {
  app.get("/api/inference-status", async () => {
    // Inference reachability = "do we have a way to call claude RIGHT
    // NOW?". Order of precedence:
    //
    //   1. ANTHROPIC_API_KEY env set         → online (pool_b, byoc-key)
    //   2. claude auth status loggedIn:true  → online (pool_b, byoc-oauth)
    //   3. Fall through to "offline" with a hint about which step is missing
    //
    // The device-pairing JWT is read for its user_id / expires_at fields
    // (still useful for the transparency chip + manifest sync flow) but
    // it is NOT the gate.
    const bundle = await tryReadDeviceBundle();

    if (process.env.ANTHROPIC_API_KEY) {
      return {
        ok: true,
        online: true,
        mode: "pool_b" as const,
        auth_source: "anthropic_api_key" as const,
        user_id: bundle?.user_id,
        expires_at: bundle?.expires_at,
      };
    }

    const status = await readClaudeAuthStatus();
    if (status?.loggedIn) {
      return {
        ok: true,
        online: true,
        mode: "pool_b" as const,
        auth_source: "claude_oauth" as const,
        claude_email: status.email,
        claude_subscription: status.subscriptionType,
        user_id: bundle?.user_id,
        expires_at: bundle?.expires_at,
      };
    }

    // Neither auth path is live — wizard suggest will hit Pool A
    // fallback (operator hub) until the customer wires BYOC. UI surfaces
    // a "Set up Claude" CTA from this state.
    return {
      ok: true,
      online: false,
      mode: "offline" as const,
      reason: status === null
        ? "claude_not_installed_or_unreachable"
        : "claude_not_authenticated",
      hint: "Run `claude auth login` (or set ANTHROPIC_API_KEY) to enable BYOC inference.",
      user_id: bundle?.user_id,
      expires_at: bundle?.expires_at,
    };
  });
}
