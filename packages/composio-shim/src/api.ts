/** Public surface used by the wavex-os onboarding routes + UI. In disabled
 *  mode every method returns the no-op equivalent (empty array, null, etc.)
 *  so the rest of the onboarding pipeline runs end-to-end. In live mode,
 *  these would dispatch to @composio/core; the live implementation is
 *  intentionally left as a single TODO marker so we can wire it up when
 *  COMPOSIO_API_KEY is available without changing call sites. */

import type { ApiKeyValidation, FeaturedToolkit, LiveConnectorRow, OAuthInitResult } from "./types.js";
import { FEATURED_TOOLKITS } from "./featured-toolkits.js";
import { getComposioApiKey, getComposioMode } from "./mode.js";

export function getFeaturedToolkits(): FeaturedToolkit[] {
  return [...FEATURED_TOOLKITS];
}

export async function listConnections(_companyId: string): Promise<LiveConnectorRow[]> {
  if (getComposioMode() === "disabled") return [];
  // Live mode — wired in STEP 13 when @composio/core is added as a dep + the
  // connectors Drizzle table is materialized. For now return [] and emit a
  // breadcrumb so callers know they hit the live branch unimplemented.
  console.warn("[composio-shim] listConnections: live mode not yet implemented; returning []");
  return [];
}

export async function validateApiKey(key: string | undefined): Promise<ApiKeyValidation> {
  if (getComposioMode() === "disabled") {
    return { ok: false, reason: "disabled", mode: "dev" };
  }
  const effective = key ?? getComposioApiKey();
  if (!effective) return { ok: false, reason: "COMPOSIO_API_KEY missing" };
  // Live validation deferred to STEP 13 (real Composio probe).
  return { ok: true };
}

export async function initOAuth(params: {
  companyId: string;
  toolkitSlug: string;
  callbackUrl: string;
}): Promise<OAuthInitResult> {
  if (getComposioMode() === "disabled") {
    return { url: null, pendingConnectionId: null };
  }
  // Live mode — real Composio Connect dance lands when @composio/core is
  // added as a dep + the connectors Drizzle table is materialized.
  // Surface a clear breadcrumb so the Avatar bridge / tools UI can show
  // "needs COMPOSIO_API_KEY + live wiring" instead of silently failing.
  // For Gmail specifically, the operator can wire credentials via the
  // existing paste-key path (packages/op-omega-server/src/routes/credentials.ts).
  console.warn(
    `[composio-shim] initOAuth(${params.toolkitSlug}): live OAuth not yet wired; ` +
    `operator should fall back to paste-key path or wait for the @composio/core integration.`,
  );
  return { url: null, pendingConnectionId: null, needsLiveWiring: true };
}

export function composioUserId(companyId: string, userId: string): string {
  return `wavex/${companyId}/${userId}`;
}
