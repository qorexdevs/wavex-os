/**
 * Composio fold-in test · onboarding integration · prompt §9.2.
 *
 * Verifies that when `liveConnections` is passed to `generateConnectorManifest`:
 *   - Matching entries flip status from 'pending_credential' to 'configured'
 *   - The optional `composio` block is populated with connection details
 *   - Non-matching entries (no live connection) keep their original status
 *   - Existing manifests without composio (legacy/no Composio integration) parse unchanged
 *
 * Plus the activation rule resolution check: with a live supabase connection,
 * `cdo.signal` and `cdo.telemetry` rules resolve from `standby` → `active`.
 *
 * No mocks required — generateConnectorManifest is pure when skipInference: true.
 */

import { describe, expect, it } from "vitest";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { generateConnectorManifest, type LiveConnectorRow } from "./generate.js";
import { evaluateAgent } from "../phase-3-swarm/activation-rules.js";
import type { PillarResponses } from "../../schema/pillar-responses.js";

function wavexLikeResponses(): PillarResponses {
  return {
    schema_version: "1.0",
    started_at: "2026-04-29T02:06:19.270Z",
    completed_at: "2026-04-29T02:07:36.450Z",
    pillar_1: {
      org_name: "Wavex",
      company_context: "Two-sided marketplace.",
      enrichment_status: "manual_capture",
      has_product: true,
      industry_hint: "marketplace",
      business_model_hint: "marketplace",
      raw_input: "www.wavexcard.com",
      enriched_at: "2026-04-29T02:06:19.269Z",
    },
    pillar_2: {
      claude_code_verified: true,
      claude_plan: "max_20x",
      inference_budget_profile: "premium",
      verified_at: "2026-04-29T02:06:29.894Z",
    },
    pillar_3: {
      product_state: "built_not_selling",
      stage: "less_than_10k_mrr",
      kpi_snapshot_initial: {
        t: "2026-04-29T02:06:46.031Z",
        mrr: 3000,
        nrr: 0.95,
        grr: 0.88,
        cac: 150,
        cac_payback_months: 2.5,
        burn_multiple: 1.4,
        activation_rate: 0.12,
        sales_cycle_days: 21,
        win_rate: 0.18,
        ltv_cac_ratio: 11.4,
        pipeline_velocity: 30000,
        narrative_strength: 0.4,
        ai_estimated: false,
      },
    },
    pillar_4: {
      lead_sources: ["inbound_ads_meta_google", "referral_word_of_mouth", "events"],
      lead_source: "inbound_ads_meta_google",
      sales_motion: "self_serve_plg",
      gtm_profile_enum: "INBOUND_PLG",
    },
    pillar_5: {
      comm_channel: "telegram",
      urgency_routing: "digest_plus_urgent_phone",
    },
  } as PillarResponses;
}

async function generate(
  liveConnections: LiveConnectorRow[],
): Promise<Awaited<ReturnType<typeof generateConnectorManifest>>> {
  const root = await mkdtemp(join(tmpdir(), "composio-fold-in-"));
  return generateConnectorManifest({
    companyId: "00000000-0000-0000-0000-000000000001",
    responses: wavexLikeResponses(),
    skipInference: true,
    liveConnections,
    now: new Date("2026-04-30T00:00:00Z"),
  } as never).catch(async (err) => {
    // The generator's writeArtifact uses the home dir by default; for tests we don't
    // care about disk persistence — re-throw if it's a "real" failure.
    throw err;
  });
}

describe("Composio onboarding fold-in", () => {
  it("with no live connections, manifest entries keep their decision-matrix status", async () => {
    const result = await generate([]);
    const supabase = result.manifest.suggested.find((e) => e.id === "supabase");
    expect(supabase).toBeDefined();
    // Wavex (built_not_selling) puts supabase in `suggested` with `pending_decision`.
    expect(supabase?.status).toBe("pending_decision");
    expect(supabase?.composio).toBeUndefined();
  });

  it("with a live supabase connection, the matching entry flips to 'configured' + composio block populated", async () => {
    const result = await generate([
      {
        toolkitSlug: "supabase",
        composioConnectionId: "ca_test_abc123",
        composioAuthConfigId: "ac_test_xyz789",
        displayName: "ops@wavex.com",
        scopes: ["read:metrics", "write:events"],
        connectedAt: new Date("2026-04-29T20:00:00Z"),
      },
    ]);
    const supabase = result.manifest.suggested.find((e) => e.id === "supabase");
    expect(supabase?.status).toBe("configured");
    expect(supabase?.composio).toBeDefined();
    expect(supabase?.composio?.connection_id).toBe("ca_test_abc123");
    expect(supabase?.composio?.auth_config_id).toBe("ac_test_xyz789");
    expect(supabase?.composio?.display_name).toBe("ops@wavex.com");
    expect(supabase?.composio?.scopes).toEqual(["read:metrics", "write:events"]);
    expect(supabase?.composio?.connected_at).toBe("2026-04-29T20:00:00.000Z");
  });

  it("non-matching entries (different toolkit) are unchanged", async () => {
    const result = await generate([
      {
        toolkitSlug: "supabase",
        composioConnectionId: "ca_test_abc123",
        composioAuthConfigId: "ac_test_xyz789",
        displayName: "ops@wavex.com",
        scopes: [],
        connectedAt: new Date("2026-04-29T20:00:00Z"),
      },
    ]);
    const telegram = result.manifest.required.find((e) => e.id === "telegram");
    expect(telegram).toBeDefined();
    expect(telegram?.status).toBe("pending_credential");
    expect(telegram?.composio).toBeUndefined();
  });

  it("activation rule for cdo.signal resolves standby→active when supabase connector is live", () => {
    // Compose the activation context as the swarm generator would, but with
    // a `connectors` set populated as if Composio had landed supabase.
    const responses = wavexLikeResponses();
    const ctxLive = {
      responses,
      connectors: new Set<string>(["supabase"]),
    };
    const verdictLive = evaluateAgent("cdo.signal", ctxLive);
    expect(verdictLive.status).toBe("active");

    // Sanity: without the connector, cdo.signal is in standby.
    const ctxEmpty = { responses, connectors: new Set<string>() };
    const verdictEmpty = evaluateAgent("cdo.signal", ctxEmpty);
    expect(verdictEmpty.status).toBe("standby");
  });

  it("activation rule for cdo.telemetry also resolves standby→active when supabase or mixpanel is live", () => {
    const responses = wavexLikeResponses();
    const ctxSupabase = { responses, connectors: new Set<string>(["supabase"]) };
    expect(evaluateAgent("cdo.telemetry", ctxSupabase).status).toBe("active");

    const ctxMixpanel = { responses, connectors: new Set<string>(["mixpanel"]) };
    expect(evaluateAgent("cdo.telemetry", ctxMixpanel).status).toBe("active");

    const ctxEmpty = { responses, connectors: new Set<string>() };
    expect(evaluateAgent("cdo.telemetry", ctxEmpty).status).toBe("standby");
  });

  it("legacy manifest path: omitting liveConnections altogether still works (backward-compat)", async () => {
    // Simulates pre-Composio behavior — generator called without liveConnections.
    const root = await mkdtemp(join(tmpdir(), "composio-legacy-"));
    const result = await generateConnectorManifest({
      companyId: "00000000-0000-0000-0000-000000000002",
      responses: wavexLikeResponses(),
      skipInference: true,
      now: new Date("2026-04-30T00:00:00Z"),
      // liveConnections intentionally omitted
    } as never);
    expect(result.manifest).toBeDefined();
    // Every entry should have no composio block.
    for (const entry of result.manifest.required) {
      expect(entry.composio).toBeUndefined();
    }
    for (const entry of result.manifest.suggested) {
      expect(entry.composio).toBeUndefined();
    }
    expect(root).toBeTruthy();
  });
});
