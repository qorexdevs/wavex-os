/** Claude Code health probe — Pillar 2's prerequisite check.
 *
 *  In oauth/apikey mode: forwards to the vendored plugin's probe, which
 *  spawns the configured claudeBin and reports installed/authenticated state.
 *
 *  In hosted mode: customers don't have their own claude CLI — the operator's
 *  Mac-mini hub serves their inference under a Pool A session. The probe
 *  short-circuits to a hub health-check instead. If the hub is reachable,
 *  return a synthetic-pass probe so Pillar 2 proceeds cleanly. */
import type { FastifyInstance, FastifyRequest } from "fastify";
import { probeClaudeCode } from "@op-omega/plugin-onboarding";
import { assertBoard, AuthError } from "@wavex-os/auth-shim";
import { getClaudeBin, getInferenceMode } from "@wavex-os/inference-adapter";

function authReq(req: FastifyRequest) {
  return { method: req.method, headers: req.headers as Record<string, string> };
}

async function hostedHubProbe(): Promise<{
  ok: boolean;
  probe: {
    installed: boolean;
    version?: string;
    authenticated: boolean;
    billing_type?: string;
    test_output?: string;
    error?: string;
  };
}> {
  const hubUrl = (process.env.WAVEX_INFERENCE_HUB_URL ?? "").replace(/\/+$/, "");
  if (!hubUrl) {
    return {
      ok: false,
      probe: {
        installed: false,
        authenticated: false,
        error: "hosted mode but WAVEX_INFERENCE_HUB_URL not set",
      },
    };
  }
  try {
    const resp = await fetch(`${hubUrl}/v1/health`);
    if (!resp.ok) {
      return {
        ok: false,
        probe: {
          installed: false,
          authenticated: false,
          error: `hub returned HTTP ${resp.status}`,
        },
      };
    }
    const body = (await resp.json()) as { service?: string; version?: string; pools?: string[] };
    if (body.service !== "wavex-inference-server") {
      return {
        ok: false,
        probe: {
          installed: false,
          authenticated: false,
          error: `hub returned unexpected service identifier: ${body.service}`,
        },
      };
    }
    return {
      ok: true,
      probe: {
        installed: true,
        version: `wavex-os hosted via ${new URL(hubUrl).hostname} (server ${body.version ?? "unknown"})`,
        authenticated: true,
        billing_type: "wavex_pool_a",
        test_output: `hub healthy; pools available: ${(body.pools ?? []).join(", ") || "A"}`,
      },
    };
  } catch (err) {
    return {
      ok: false,
      probe: {
        installed: false,
        authenticated: false,
        error: err instanceof Error ? err.message : String(err),
      },
    };
  }
}

export function registerProbeRoutes(app: FastifyInstance): void {
  app.get("/op-omega/onboarding/claude-code-check", async (req, reply) => {
    const ar = authReq(req);
    try { assertBoard(ar); } catch (e) {
      if (e instanceof AuthError) return reply.status(e.statusCode).send({ error: e.message });
      throw e;
    }
    // Hosted mode: customer has no local claude CLI; check the hub instead.
    if (getInferenceMode() === "hosted") {
      const result = await hostedHubProbe();
      if (!result.ok) return reply.status(503).send(result);
      return result;
    }
    try {
      const probe = await probeClaudeCode({ bin: getClaudeBin() });
      return { ok: true, probe };
    } catch (e) {
      return reply.status(503).send({
        ok: false,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  });

  app.get("/op-omega/onboarding/loop-status", async (req, reply) => {
    const ar = authReq(req);
    try { assertBoard(ar); } catch (e) {
      if (e instanceof AuthError) return reply.status(e.statusCode).send({ error: e.message });
      throw e;
    }
    // Minimal placeholder — the upstream loop-status reads from the
    // budget-policy + cost-event tables. Wired in STEP 13.
    return { ok: true, loop: { status: "idle", lastTick: null } };
  });
}
