/** GET /api/inference-status — device-pairing-aware inference reachability.
 *
 *  Powers the onboarding-ui's "Inference online/offline" chip in a way that
 *  reflects what's TRUE for a paying customer's Pool B path, not the
 *  operator's local Pool A shim:
 *
 *    online === device-token.json exists on disk AND access_token has not
 *    expired (verified via cloud-client.introspectBundle()).
 *
 *  Customers don't have a local Claude CLI or hosted-shim; their inference
 *  goes through Supabase Realtime backed by the operator's Mac. The old
 *  probe (claude-code-check) returned "offline" on customer machines even
 *  when Pool B was fully functional, because it only knows about the local
 *  CLI and the hub-tunnel mode. This route is the truthful replacement.
 *
 *  Cheap: single fs read + JWT verify, no network. */

import type { FastifyInstance } from "fastify";
import { introspectBundle } from "@wavex-os/cloud-client";

export function registerDeviceStatusRoute(app: FastifyInstance): void {
  app.get("/api/inference-status", async () => {
    try {
      const r = await introspectBundle();
      if (r.ok && r.bundle) {
        return {
          ok: true,
          online: true,
          mode: "pool_b" as const,
          user_id: r.bundle.user_id,
          expires_at: r.bundle.access_token_expires_at,
        };
      }
      return {
        ok: true,
        online: false,
        mode: "offline" as const,
        reason: r.reason ?? "no_bundle",
      };
    } catch (err) {
      return {
        ok: true,
        online: false,
        mode: "offline" as const,
        reason: err instanceof Error ? err.message : String(err),
      };
    }
  });
}
