/** GET /api/inference-status — device-pairing-aware inference reachability.
 *
 *  Powers the onboarding-ui's "Inference online/offline" chip. Returns the
 *  TRUE state of a paying customer's Pool B path, and on expired-but-
 *  refreshable bundles will trigger the os-device-refresh round-trip itself
 *  so the chip auto-heals without ever asking the customer to type a
 *  terminal command.
 *
 *  States:
 *    online === bundle on disk + JWT valid (after self-heal)
 *    online === false + reason === "no_bundle"        — no pair at all
 *    online === false + reason === "refresh_failed"   — refresh_token revoked / network down
 *    online === false + reason === "malformed"        — local-side error
 *
 *  The customer never sees "expired" as a terminal state — if the bundle
 *  has an expired access_token but a still-valid refresh_token, this route
 *  rotates the access_token via os-device-refresh and returns online=true.
 *  The refresh round-trip is ~200ms; chip flips green within one poll. */

import type { FastifyInstance } from "fastify";
import { introspectBundle, getValidAccessToken, readBundle } from "@wavex-os/cloud-client";

export function registerDeviceStatusRoute(app: FastifyInstance): void {
  app.get("/api/inference-status", async () => {
    try {
      const initial = await introspectBundle();

      // Happy path — bundle present and access_token still valid.
      if (initial.ok && initial.bundle) {
        return {
          ok: true,
          online: true,
          mode: "pool_b" as const,
          user_id: initial.bundle.user_id,
          expires_at: initial.bundle.access_token_expires_at,
        };
      }

      // Self-heal: bundle exists but access_token has expired. Trigger
      // a refresh via getValidAccessToken (transparent refresh_token
      // exchange against os-device-refresh). Refused-to-refresh tokens
      // fall through to "refresh_failed".
      if (initial.reason === "expired" && initial.bundle) {
        try {
          await getValidAccessToken();
          // Re-read post-refresh so we report the new expiry.
          const refreshed = await readBundle();
          if (refreshed) {
            return {
              ok: true,
              online: true,
              mode: "pool_b" as const,
              user_id: refreshed.user_id,
              expires_at: refreshed.access_token_expires_at,
              refreshed: true,
            };
          }
        } catch (refreshErr) {
          return {
            ok: true,
            online: false,
            mode: "offline" as const,
            reason: "refresh_failed",
            detail: refreshErr instanceof Error ? refreshErr.message : String(refreshErr),
          };
        }
      }

      // No bundle, malformed, or other terminal local-side failure.
      return {
        ok: true,
        online: false,
        mode: "offline" as const,
        reason: initial.reason ?? "no_bundle",
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
