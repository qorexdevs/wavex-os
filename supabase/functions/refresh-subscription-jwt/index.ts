/**
 * F.4.f / F.5 — Liaison JWT refresh.
 *
 * Pool C requires the customer's Liaison to present a short-lived JWT bound
 * to their `subscription_id` on every call to the Mac mini inference server
 * (see docs/INFERENCE_AUTH.md §"Pool C"). JWTs are HS256, signed with
 * `WAVEX_LIAISON_JWT_SECRET`, and rotated every 24h.
 *
 * This function is the rotation endpoint. The Liaison invokes it once per
 * rotation window with its current JWT in the Authorization header. The
 * function:
 *   1. Parses + verifies the incoming JWT signature.
 *   2. Confirms the subscription is still active in Supabase.
 *   3. Issues a fresh JWT with the same `sub` (subscription_id) + tier and
 *      a new `exp` (now + 24h) + new `jti` (so the previous token can be
 *      revoked without dragging the next one with it).
 *   4. Returns the new JWT + expiry to the caller.
 *
 * The initial JWT is issued at hire-time by the wavex-os-subscription-webhook function
 * (TODO: F.5.b — adding that path is what closes the F.5 loop on the
 * webhook side). Until that lands, customers who hire an Expert Agent
 * receive an empty `jwt` field; they hit this endpoint with NO bearer
 * token + a `bootstrap` body field. Bootstrap path is permitted only when
 * the requesting subscription is active (DB lookup via service-role key).
 *
 * Deploy:
 *   supabase login                                  # interactive
 *   supabase functions deploy refresh-subscription-jwt --no-verify-jwt
 *
 * Required secrets:
 *   supabase secrets set WAVEX_LIAISON_JWT_SECRET=<32+ random bytes b64>
 *
 * Auto-injected by Supabase:
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *
 * --no-verify-jwt because the JWT being verified IS what this function
 * issues — Supabase's own JWT layer would reject the Liaison's WaveX JWT
 * as the wrong audience.
 */
// @ts-expect-error — Deno-style import resolved at runtime
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.46.1";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const jwtSecret = Deno.env.get("WAVEX_LIAISON_JWT_SECRET");

const TTL_SECONDS = 24 * 60 * 60; // 24h
const MAX_REFRESH_AGE_SECONDS = 7 * 24 * 60 * 60; // can't refresh a JWT > 7d old

const supabase = createClient(supabaseUrl, serviceKey);

interface LiaisonClaims {
  sub: string; // subscription_id (uuid)
  tier: string;
  iat: number;
  exp: number;
  jti: string;
}

function b64url(input: Uint8Array | string): string {
  const bytes =
    typeof input === "string" ? new TextEncoder().encode(input) : input;
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

function b64urlDecodeToBytes(s: string): Uint8Array {
  s = s.replace(/-/g, "+").replace(/_/g, "/");
  const pad = s.length % 4 ? 4 - (s.length % 4) : 0;
  const bin = atob(s + "=".repeat(pad));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function hmacSha256(key: string, message: string): Promise<Uint8Array> {
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(key),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
  const sig = await crypto.subtle.sign("HMAC", cryptoKey, new TextEncoder().encode(message));
  return new Uint8Array(sig);
}

function constantTimeEquals(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

async function signJwt(claims: LiaisonClaims): Promise<string> {
  if (!jwtSecret) throw new Error("WAVEX_LIAISON_JWT_SECRET not configured");
  const header = b64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payload = b64url(JSON.stringify(claims));
  const sig = await hmacSha256(jwtSecret, `${header}.${payload}`);
  return `${header}.${payload}.${b64url(sig)}`;
}

async function verifyJwt(token: string): Promise<LiaisonClaims | null> {
  if (!jwtSecret) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [header, payload, sig] = parts;
  const expected = await hmacSha256(jwtSecret, `${header}.${payload}`);
  const got = b64urlDecodeToBytes(sig);
  if (!constantTimeEquals(expected, got)) return null;
  try {
    const claims = JSON.parse(new TextDecoder().decode(b64urlDecodeToBytes(payload))) as LiaisonClaims;
    if (typeof claims.sub !== "string") return null;
    if (typeof claims.exp !== "number") return null;
    return claims;
  } catch {
    return null;
  }
}

async function lookupActiveSubscription(subscriptionId: string): Promise<{
  ok: boolean;
  tier?: string;
  status?: string;
  reason?: string;
}> {
  // wavex_os schema is not exposed via PostgREST on this project; the public-schema
  // `wavex_os_subscription_lookup` RPC bridges to wavex_os.subscriptions.
  const { data, error } = await supabase.rpc("wavex_os_subscription_lookup", {
    p_subscription_id: subscriptionId,
  });
  if (error) return { ok: false, reason: `db_error: ${error.message}` };
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) return { ok: false, reason: "subscription_not_found" };
  if (!["active", "trialing"].includes(row.status as string)) {
    return { ok: false, reason: `subscription_status_${row.status}` };
  }
  return { ok: true, tier: row.tier as string, status: row.status as string };
}

function newJti(): string {
  const buf = new Uint8Array(16);
  crypto.getRandomValues(buf);
  return Array.from(buf).map((b) => b.toString(16).padStart(2, "0")).join("");
}

interface RequestBody {
  bootstrap?: boolean;
  subscription_id?: string;
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "method_not_allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  let body: RequestBody;
  try {
    body = (await req.json()) as RequestBody;
  } catch {
    body = {};
  }

  const auth = req.headers.get("authorization") ?? "";
  const bearer = auth.startsWith("Bearer ") ? auth.slice("Bearer ".length).trim() : "";

  let subscriptionId: string | null = null;
  let priorClaims: LiaisonClaims | null = null;

  if (bearer) {
    priorClaims = await verifyJwt(bearer);
    if (!priorClaims) {
      return new Response(JSON.stringify({ error: "invalid_token" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }
    // Allow refresh only within 7d window from issuance — past that, the
    // Liaison must re-bootstrap so we know the subscription is still good.
    const ageSec = Math.floor(Date.now() / 1000) - priorClaims.iat;
    if (ageSec > MAX_REFRESH_AGE_SECONDS) {
      return new Response(
        JSON.stringify({
          error: "token_too_old",
          message: "Token > 7d since issuance; re-bootstrap required",
        }),
        { status: 401, headers: { "Content-Type": "application/json" } },
      );
    }
    subscriptionId = priorClaims.sub;
  } else if (body.bootstrap && body.subscription_id) {
    subscriptionId = body.subscription_id;
  } else {
    return new Response(
      JSON.stringify({
        error: "missing_credentials",
        message: "Provide either an Authorization: Bearer header or { bootstrap: true, subscription_id }",
      }),
      { status: 401, headers: { "Content-Type": "application/json" } },
    );
  }

  const lookup = await lookupActiveSubscription(subscriptionId);
  if (!lookup.ok) {
    return new Response(
      JSON.stringify({ error: "subscription_not_active", reason: lookup.reason }),
      { status: 403, headers: { "Content-Type": "application/json" } },
    );
  }

  const iat = Math.floor(Date.now() / 1000);
  const exp = iat + TTL_SECONDS;
  const claims: LiaisonClaims = {
    sub: subscriptionId,
    tier: lookup.tier!,
    iat,
    exp,
    jti: newJti(),
  };
  const token = await signJwt(claims);

  return new Response(
    JSON.stringify({
      jwt: token,
      expires_at: new Date(exp * 1000).toISOString(),
      tier: claims.tier,
      subscription_id: subscriptionId,
      // bootstrap response indicates whether the prior token was used so
      // the client can persist accordingly. null = bootstrap path.
      rotated_from_jti: priorClaims?.jti ?? null,
    }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
});
