/**
 * Layer 2 of the self-healing architecture: OAuth refresh with concurrency lock.
 *
 * Reference implementation. See docs/SELF_HEALING.md for the architectural
 * narrative. Field-tested in production for ~7 days; the concurrency lock
 * + invalid_grant retry was added after a real incident in which three
 * concurrent maintenance-UI clicks burned through a refresh_token because
 * each request read the same token, only one exchange could win, and the
 * losers got HTTP 400 invalid_grant.
 *
 * CRITICAL invariants:
 *  1. Refresh tokens are SINGLE-USE and rotate on every grant.
 *  2. If we make the network call but fail to write the result back to the
 *     credential store, the store is left with a now-invalid refresh token
 *     and the user must `claude /login` manually.
 *  3. So: read → exchange → write must be atomic, with the write being the
 *     absolute next step after a successful exchange response.
 *  4. Concurrent callers MUST coalesce onto a single in-flight Promise.
 *  5. After a successful exchange, a short cooldown returns the cached
 *     fresh token instead of burning another refresh_token cycle.
 */

const ANTHROPIC_OAUTH_TOKEN_URL = "https://api.anthropic.com/v1/oauth/token";
const CLAUDE_CODE_OAUTH_CLIENT_ID = "9d1c250a-e61b-44d9-88ed-5944d1962f5e";
const REFRESH_COOLDOWN_MS = 30_000;
const AUTO_REFRESH_COOLDOWN_MS = 60_000;
const REFRESH_REQUEST_TIMEOUT_MS = 15_000;
const KEYCHAIN_WRITE_TIMEOUT_MS = 8_000;
const INVALID_GRANT_RETRY_DELAY_MS = 250;

export type OauthEnvelope = {
  claudeAiOauth: {
    accessToken: string;
    refreshToken: string;
    expiresAt: number;
  };
};

export type RefreshResult =
  | {
      ok: true;
      newAccessTokenPrefix: string;
      newExpiresAt: number;
      rotatedRefreshToken: boolean;
    }
  | {
      ok: false;
      reason:
        | "no_keychain"
        | "refresh_rejected"
        | "keychain_write_failed"
        | "network_error";
      detail?: string;
    };

/**
 * The credential adapter. The reference implementation reads/writes the
 * macOS keychain via `security`. To support Linux/Windows, swap this out
 * for libsecret / Credential Manager respectively.
 */
export type CredentialAdapter = {
  read: () => Promise<OauthEnvelope | null>;
  write: (env: OauthEnvelope) => Promise<{ ok: true } | { ok: false; error: string }>;
};

/**
 * Coalesce concurrent callers onto a single in-flight refresh. WITHOUT
 * this, parallel callers (e.g. wrapper-fallback firing from N concurrent
 * worker 401s + a manual maintenance-UI click) all read the SAME refresh
 * token; Anthropic accepts the first exchange and rotates the token; the
 * rest get HTTP 400 invalid_grant; the credential store ends up with a
 * stale token written by the WINNING call, so subsequent fresh attempts
 * also fail. This singleton makes them all await the same exchange.
 */
let inflightRefresh: Promise<RefreshResult> | null = null;
let lastSuccessfulRefreshAt = 0;
let lastAutoRefreshAt = 0;

async function performRefreshOnce(
  credentials: CredentialAdapter,
  invalidateApiValidityCache: () => void,
): Promise<RefreshResult> {
  const envelope = await credentials.read();
  if (!envelope) {
    return {
      ok: false,
      reason: "no_keychain",
      detail: "could not read credentials from credential store",
    };
  }

  let response: Response;
  try {
    response = await fetch(ANTHROPIC_OAUTH_TOKEN_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "anthropic-beta": "oauth-2025-04-20",
      },
      body: JSON.stringify({
        grant_type: "refresh_token",
        refresh_token: envelope.claudeAiOauth.refreshToken,
        client_id: CLAUDE_CODE_OAUTH_CLIENT_ID,
      }),
      signal: AbortSignal.timeout(REFRESH_REQUEST_TIMEOUT_MS),
    });
  } catch (err) {
    return {
      ok: false,
      reason: "network_error",
      detail: err instanceof Error ? err.message : String(err),
    };
  }

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    return {
      ok: false,
      reason: "refresh_rejected",
      detail: `HTTP ${response.status}: ${text.slice(0, 200)}`,
    };
  }

  type GrantResponse = {
    access_token: string;
    refresh_token?: string;
    expires_in?: number;
  };
  const grant = (await response.json().catch(() => null)) as GrantResponse | null;
  if (!grant?.access_token) {
    return {
      ok: false,
      reason: "refresh_rejected",
      detail: "response missing access_token",
    };
  }

  const expiresIn = typeof grant.expires_in === "number" ? grant.expires_in : 28_800;
  const newEnvelope: OauthEnvelope = {
    ...envelope,
    claudeAiOauth: {
      ...envelope.claudeAiOauth,
      accessToken: grant.access_token,
      refreshToken: grant.refresh_token ?? envelope.claudeAiOauth.refreshToken,
      expiresAt: Date.now() + expiresIn * 1000,
    },
  };

  // Race the keychain write against a hard timeout — on macOS, an ACL
  // prompt can block the `security` command indefinitely.
  const write = await Promise.race([
    credentials.write(newEnvelope),
    new Promise<{ ok: false; error: string }>((resolve) =>
      setTimeout(
        () =>
          resolve({
            ok: false,
            error: "credential write timed out (likely ACL prompt blocking)",
          }),
        KEYCHAIN_WRITE_TIMEOUT_MS,
      ),
    ),
  ]);

  if (!write.ok) {
    // Credential store is now in an inconsistent state — we have a fresh
    // access_token we can't persist, and the old refresh_token has been
    // rotated out. Surface this loudly so the user knows to re-login.
    return {
      ok: false,
      reason: "keychain_write_failed",
      detail: write.error ?? "unknown",
    };
  }

  invalidateApiValidityCache();
  lastAutoRefreshAt = Date.now();
  lastSuccessfulRefreshAt = Date.now();

  return {
    ok: true,
    newAccessTokenPrefix: grant.access_token.slice(0, 25),
    newExpiresAt: newEnvelope.claudeAiOauth.expiresAt,
    rotatedRefreshToken: typeof grant.refresh_token === "string",
  };
}

export async function refreshOauthFromKeychain(deps: {
  credentials: CredentialAdapter;
  invalidateApiValidityCache?: () => void;
}): Promise<RefreshResult> {
  const invalidate = deps.invalidateApiValidityCache ?? (() => {});

  // Cooldown: if a successful refresh just happened, return the current
  // (fresh) credential state instead of burning another refresh_token.
  if (Date.now() - lastSuccessfulRefreshAt < REFRESH_COOLDOWN_MS) {
    const env = await deps.credentials.read();
    if (env) {
      return {
        ok: true,
        newAccessTokenPrefix: env.claudeAiOauth.accessToken.slice(0, 25),
        newExpiresAt: env.claudeAiOauth.expiresAt,
        rotatedRefreshToken: false,
      };
    }
  }

  // Coalesce concurrent callers onto a single in-flight refresh.
  if (inflightRefresh) return inflightRefresh;
  inflightRefresh = (async () => {
    try {
      let result = await performRefreshOnce(deps.credentials, invalidate);
      // If we got refresh_rejected with invalid_grant, ANOTHER caller (or
      // an external `claude /login`) may have just rotated the token.
      // Retry ONCE after re-reading — the new refresh_token may now be
      // present in the credential store.
      if (
        !result.ok &&
        result.reason === "refresh_rejected" &&
        typeof result.detail === "string" &&
        /invalid_grant/i.test(result.detail)
      ) {
        await new Promise((r) => setTimeout(r, INVALID_GRANT_RETRY_DELAY_MS));
        result = await performRefreshOnce(deps.credentials, invalidate);
      }
      return result;
    } finally {
      inflightRefresh = null;
    }
  })();
  return inflightRefresh;
}

export function autoRefreshCooldownActive(): boolean {
  return Date.now() - lastAutoRefreshAt < AUTO_REFRESH_COOLDOWN_MS;
}

/* -------------------------------------------------------------------------- */
/* macOS reference implementation of CredentialAdapter                        */
/* -------------------------------------------------------------------------- */

import { execFile as execFileCb } from "node:child_process";
import { promisify } from "node:util";
const execFile = promisify(execFileCb);

const KEYCHAIN_SERVICE = "Claude Code-credentials";

export const macKeychainAdapter: CredentialAdapter = {
  async read() {
    try {
      const { stdout } = await execFile(
        "security",
        ["find-generic-password", "-w", "-s", KEYCHAIN_SERVICE],
        { timeout: 5_000 },
      );
      const blob = stdout.trim();
      if (!blob) return null;
      const parsed = JSON.parse(blob) as Partial<OauthEnvelope>;
      if (!parsed?.claudeAiOauth?.accessToken || !parsed.claudeAiOauth.refreshToken) {
        return null;
      }
      return parsed as OauthEnvelope;
    } catch {
      return null;
    }
  },
  async write(envelope) {
    const blob = JSON.stringify(envelope);
    try {
      await execFile(
        "security",
        ["add-generic-password", "-U", "-s", KEYCHAIN_SERVICE, "-a", KEYCHAIN_SERVICE, "-w", blob],
        { timeout: KEYCHAIN_WRITE_TIMEOUT_MS },
      );
      return { ok: true };
    } catch (err) {
      return {
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  },
};
