/**
 * Activation-rule extension tests · Credential Concierge integration.
 *
 * Verifies `applyCredentialStateToVerdict` flips connector-dependent verdicts
 * to `parked` when the gating credential is `skipped`/`invalid`. Existing
 * rules don't read `credentialStatus` directly — they remain pure functions
 * keyed off `connectors: Set<string>` — so callers OPT IN to credential-awareness
 * by passing `credentialStatus` and post-processing verdicts via this helper.
 *
 * No mocks needed — pure logic.
 */

import { describe, expect, it } from "vitest";
import {
  applyCredentialStateToVerdict,
  CONNECTOR_TO_GATING_CREDENTIAL,
  evaluateAgent,
  type ActivationContext,
  type ActivationVerdict,
} from "./activation-rules.js";
import type { PillarResponses } from "../../schema/pillar-responses.js";

function makeWavexCtx(overrides: Partial<ActivationContext> = {}): ActivationContext {
  const responses = {
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
      kpi_snapshot_initial: { ai_estimated: false } as unknown,
    },
    pillar_4: {
      lead_sources: ["inbound_ads_meta_google"],
      lead_source: "inbound_ads_meta_google",
      sales_motion: "self_serve_plg",
      gtm_profile_enum: "INBOUND_PLG",
    },
    pillar_5: { comm_channel: "telegram" },
  } as unknown as PillarResponses;

  return {
    responses,
    connectors: new Set<string>(),
    ...overrides,
  };
}

describe("Credential-aware activation", () => {
  it("CONNECTOR_TO_GATING_CREDENTIAL maps the expected providers", () => {
    expect(CONNECTOR_TO_GATING_CREDENTIAL.supabase).toBe("supabase_service_role_key");
    expect(CONNECTOR_TO_GATING_CREDENTIAL.github).toBe("github_pat");
    expect(CONNECTOR_TO_GATING_CREDENTIAL.mixpanel).toBe("mixpanel_project_token");
    // Composio-handled connectors should NOT have direct credential gates.
    expect(CONNECTOR_TO_GATING_CREDENTIAL.slack).toBeUndefined();
    expect(CONNECTOR_TO_GATING_CREDENTIAL.gmail).toBeUndefined();
  });

  it("returns the original verdict unchanged when credentialStatus is absent", () => {
    const ctx = makeWavexCtx();
    const original: ActivationVerdict = { status: "active" };
    const result = applyCredentialStateToVerdict(original, ctx, "supabase");
    expect(result).toEqual(original);
  });

  it("returns the original verdict unchanged when credential status is 'valid'", () => {
    const ctx = makeWavexCtx({
      credentialStatus: { supabase_service_role_key: "valid" },
    });
    const original: ActivationVerdict = { status: "active" };
    expect(applyCredentialStateToVerdict(original, ctx, "supabase")).toEqual(original);
  });

  it("flips an active verdict to parked when the gating credential is 'skipped'", () => {
    const ctx = makeWavexCtx({
      credentialStatus: { supabase_service_role_key: "skipped" },
    });
    const original: ActivationVerdict = { status: "active" };
    const result = applyCredentialStateToVerdict(original, ctx, "supabase");
    expect(result.status).toBe("parked");
    if (result.status === "parked") {
      expect(result.unpark_condition).toContain("supabase_service_role_key");
      expect(result.unpark_condition).toContain("skipped");
    }
  });

  it("flips a standby verdict to parked when the gating credential is 'invalid'", () => {
    const ctx = makeWavexCtx({
      credentialStatus: { mixpanel_project_token: "invalid" },
    });
    const original: ActivationVerdict = {
      status: "standby",
      waiting_on_connector: "mixpanel",
    };
    const result = applyCredentialStateToVerdict(original, ctx, "mixpanel");
    expect(result.status).toBe("parked");
  });

  it("does not flip when credential status is 'unvalidated' (operator hasn't yet pasted)", () => {
    const ctx = makeWavexCtx({
      credentialStatus: { github_pat: "unvalidated" },
    });
    const original: ActivationVerdict = { status: "active" };
    const result = applyCredentialStateToVerdict(original, ctx, "github");
    // 'unvalidated' is not 'skipped' or 'invalid' — verdict stays as-is.
    expect(result).toEqual(original);
  });

  it("does not flip when the connector slug is not in CONNECTOR_TO_GATING_CREDENTIAL (Composio-handled)", () => {
    const ctx = makeWavexCtx({
      credentialStatus: { slack_credential: "skipped" },
    });
    const original: ActivationVerdict = { status: "active" };
    expect(applyCredentialStateToVerdict(original, ctx, "slack")).toEqual(original);
  });

  it("end-to-end: Wavex's cdo.signal evaluates active when supabase connector is in ctx.connectors AND credential is valid", () => {
    const ctx = makeWavexCtx({
      connectors: new Set(["supabase"]),
      credentialStatus: { supabase_service_role_key: "valid" },
    });
    const verdict = evaluateAgent("cdo.signal", ctx);
    expect(verdict.status).toBe("active");
    const final = applyCredentialStateToVerdict(verdict, ctx, "supabase");
    expect(final.status).toBe("active");
  });

  it("end-to-end: Wavex's cdo.signal flips active → parked when supabase connector is set BUT credential is skipped", () => {
    const ctx = makeWavexCtx({
      connectors: new Set(["supabase"]),
      credentialStatus: { supabase_service_role_key: "skipped" },
    });
    const verdict = evaluateAgent("cdo.signal", ctx);
    expect(verdict.status).toBe("active");
    const final = applyCredentialStateToVerdict(verdict, ctx, "supabase");
    expect(final.status).toBe("parked");
    if (final.status === "parked") {
      expect(final.unpark_condition).toContain("supabase_service_role_key");
    }
  });

  it("coo.credentials is alwaysActive (the new sub-agent ships dormant but is registered)", () => {
    const ctx = makeWavexCtx();
    const verdict = evaluateAgent("coo.credentials", ctx);
    expect(verdict.status).toBe("active");
  });
});
