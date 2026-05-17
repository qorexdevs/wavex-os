/**
 * P3 / WAVEX_LOCAL_OPS_PUSH — os-instance-health Edge Function.
 *
 * The customer's local-ops daemon (scripts/wavex-local-ops-cycle.mjs) calls
 * this once per cycle (~5 min) with its full state file. We translate that
 * state into a wavex_os.instance_health row so the operator's WaveX Mission
 * Control admin fleet can see every paying customer's installation in real
 * time.
 *
 * Request: POST application/json
 *   { device_jwt: string, state_file_content: <state file JSON> }
 *
 * Response: always HTTP 200; discriminated by `ok`.
 *   { ok: true,  inserted_id: uuid, reported_at: iso }
 *   { ok: false, error: string,    reason?: string }
 *
 * Auth: device JWT is decoded but not signature-verified (mirrors the
 * os-link-device / os-claim-device defense-in-depth pattern — the service-role
 * SECURITY DEFINER RPC re-validates the device exists).  An attacker forging
 * a JWT for a real device_id could spoof one row, but cannot read anything;
 * the operator fleet UI sees latest-per-device and the device's real daemon
 * will overwrite the spoof on its next 5-min cycle.
 *
 * Deploy:
 *   supabase functions deploy os-instance-health --no-verify-jwt
 *
 * Auto-injected: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.
 */
// @ts-expect-error — Deno-style import resolved at runtime
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.46.1";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(supabaseUrl, serviceKey);

function b64urlDecodeJson(s: string): Record<string, unknown> | null {
  try {
    s = s.replace(/-/g, "+").replace(/_/g, "/");
    const pad = s.length % 4 ? 4 - (s.length % 4) : 0;
    const bin = atob(s + "=".repeat(pad));
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    return null;
  }
}

function decodeDeviceJwt(token: string): { user_id: string; device_id: string } | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const claims = b64urlDecodeJson(parts[1]);
  if (!claims) return null;
  const sub = typeof claims.sub === "string" ? claims.sub : null;
  const device_id = typeof claims.device_id === "string" ? (claims.device_id as string) : null;
  if (!sub || !device_id) return null;
  return { user_id: sub, device_id };
}

interface DaemonState {
  schema_version?: number;
  ran_at?: number;
  checks?: {
    token?: { status?: string; detail?: string | null };
    git?: { status?: string; detail?: string | null };
    install?: { status?: string; detail?: string | null };
    build?: { status?: string; detail?: string | null };
    processes?: {
      status?: string;
      mock_core?: string;
      wavex_os_server?: string;
      paperclip?: string;
      detail?: string | null;
      restarted?: string[];
    };
  } | null;
  requires_user_action?: {
    reason?: string;
    button_label?: string;
    detail?: string;
  } | null;
}

interface DerivedHealth {
  paperclip_reachable: boolean;
  fleet_status: "healthy" | "degraded" | "down";
  recent_errors: Array<{ source: string; detail: string }>;
  last_heartbeat_at: string | null;
}

function deriveHealth(state: DaemonState): DerivedHealth {
  const checks = state.checks ?? null;
  const procs = checks?.processes ?? null;
  const paperclip_reachable = procs?.paperclip === "alive";

  const allDead =
    procs &&
    procs.mock_core === "dead" &&
    procs.wavex_os_server === "dead" &&
    procs.paperclip === "dead";

  let fleet_status: "healthy" | "degraded" | "down";
  if (allDead) {
    fleet_status = "down";
  } else if (
    state.requires_user_action ||
    procs?.status === "some_dead" ||
    checks?.token?.status === "refresh_failed" ||
    checks?.git?.status === "fetch_failed" ||
    checks?.git?.status === "dirty_tree" ||
    checks?.install?.status === "failed" ||
    checks?.build?.status === "failed"
  ) {
    fleet_status = "degraded";
  } else {
    fleet_status = "healthy";
  }

  const recent_errors: Array<{ source: string; detail: string }> = [];
  const addError = (source: string, detail: string | null | undefined) => {
    if (detail) recent_errors.push({ source, detail: String(detail).slice(0, 500) });
  };
  addError("token", checks?.token?.detail);
  addError("git", checks?.git?.detail);
  addError("install", checks?.install?.detail);
  addError("build", checks?.build?.detail);
  addError("processes", procs?.detail);

  const last_heartbeat_at = state.ran_at
    ? new Date(state.ran_at * 1000).toISOString()
    : null;

  return { paperclip_reachable, fleet_status, recent_errors, last_heartbeat_at };
}

interface RequestBody {
  device_jwt?: string;
  state_file_content?: DaemonState;
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ ok: false, error: "method_not_allowed" }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  }

  let body: RequestBody;
  try {
    body = (await req.json()) as RequestBody;
  } catch {
    return new Response(
      JSON.stringify({ ok: false, error: "invalid_json" }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  }

  if (!body.device_jwt || !body.state_file_content) {
    return new Response(
      JSON.stringify({ ok: false, error: "missing_fields", reason: "need device_jwt + state_file_content" }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  }

  const decoded = decodeDeviceJwt(body.device_jwt);
  if (!decoded) {
    return new Response(
      JSON.stringify({ ok: false, error: "invalid_device_jwt" }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  }

  // Look up subscription_id by user_id (service-role SECURITY DEFINER RPC).
  // A missing subscription is non-fatal — the daemon can be running on a
  // free-tier machine whose paid sub got cancelled; we still want to see it.
  let subscription_id: string | null = null;
  let tier = "pool_a";
  const { data: subData, error: subErr } = await supabase.rpc(
    "wavex_os_subscription_lookup_by_user",
    { p_user_id: decoded.user_id },
  );
  if (!subErr && Array.isArray(subData) && subData.length > 0) {
    subscription_id = (subData[0].id as string) ?? null;
    tier = (subData[0].tier as string) ?? "pool_a";
  }

  const derived = deriveHealth(body.state_file_content);

  const { data: insData, error: insErr } = await supabase.rpc(
    "os_record_instance_health",
    {
      _device_id: decoded.device_id,
      _subscription_id: subscription_id,
      _tier: tier,
      _paperclip_reachable: derived.paperclip_reachable,
      _agents_idle: 0,
      _agents_running: 0,
      _agents_error: 0,
      _fleet_status: derived.fleet_status,
      _recent_errors: derived.recent_errors,
      _last_heartbeat_at: derived.last_heartbeat_at,
      _local_ops_state: body.state_file_content,
      _requires_user_action: body.state_file_content.requires_user_action ?? null,
    },
  );

  if (insErr) {
    return new Response(
      JSON.stringify({
        ok: false,
        error: "insert_failed",
        reason: insErr.message,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  }

  const inserted = Array.isArray(insData) ? insData[0] : insData;
  return new Response(
    JSON.stringify({
      ok: true,
      inserted_id: inserted?.id ?? null,
      reported_at: new Date().toISOString(),
      fleet_status: derived.fleet_status,
      subscription_id,
    }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
});
