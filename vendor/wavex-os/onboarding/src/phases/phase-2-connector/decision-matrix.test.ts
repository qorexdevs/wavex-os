import { describe, expect, it } from "vitest";
import { runDecisionMatrix } from "./decision-matrix.js";
import type { PillarResponses } from "../../schema/pillar-responses.js";

function fullResponses(overrides: Partial<PillarResponses> = {}): PillarResponses {
  return {
    schema_version: "1.0",
    started_at: "2026-04-20T00:00:00Z",
    completed_at: "2026-04-20T00:05:00Z",
    pillar_1: {
      org_name: "Acme",
      company_context: "B2B SaaS workflow automation.",
      has_product: true,
      industry_hint: "b2b_saas",
      business_model_hint: "subscription",
      raw_input: "https://acme.example",
      enriched_at: "2026-04-20T00:01:00Z",
    },
    pillar_2: {
      claude_code_verified: true,
      claude_plan: "max_20x",
      inference_budget_profile: "premium",
      verified_at: "2026-04-20T00:02:00Z",
    },
    pillar_3: {
      product_state: "live_paying_customers",
      stage: "10k_100k_mrr",
      kpi_snapshot_initial: {
        t: "2026-04-20T00:03:00Z",
        mrr: 45_000,
        nrr: 1.05,
        grr: 0.92,
        cac: 900,
        cac_payback_months: 12,
        burn_multiple: 1.3,
        activation_rate: 0.42,
        sales_cycle_days: 28,
        win_rate: 0.22,
        ltv_cac_ratio: 2.8,
        pipeline_velocity: 150_000,
        narrative_strength: 0.5,
        ai_estimated: true,
      },
    },
    pillar_4: {
      lead_sources: ["outbound_cold"],
      lead_source: "outbound_cold",
      sales_motion: "high_touch_enterprise",
      close_channel: "mostly_phone_video",
      gtm_profile_enum: "OUTBOUND_HIGH_TOUCH_SAAS",
    },
    pillar_5: {
      comm_channel: "slack",
    },
    ...overrides,
  };
}

describe("Phase 2 decision matrix", () => {
  it("produces a manifest with schema version and future expiry", () => {
    const m = runDecisionMatrix(fullResponses());
    expect(m.schema_version).toBe("1.0");
    expect(new Date(m.dry_run_expires_at).getTime()).toBeGreaterThan(Date.now());
    expect(m.required.length).toBeGreaterThan(0);
  });

  it("always requires claude-code as P-1", () => {
    const m = runDecisionMatrix(fullResponses());
    const cc = m.required.find((r) => r.id === "claude-code");
    expect(cc).toBeDefined();
    expect(cc?.priority).toBe("P-1");
  });

  it("requires supabase + blocks on approval when live paying customers", () => {
    const m = runDecisionMatrix(fullResponses());
    expect(m.required.some((r) => r.id === "supabase")).toBe(true);
    expect(m.blocked_on_manual_approval.some((b) => b.id === "supabase")).toBe(true);
  });

  it("suggests supabase when product exists but pre-revenue", () => {
    const m = runDecisionMatrix(
      fullResponses({
        pillar_3: {
          ...fullResponses().pillar_3!,
          product_state: "built_not_selling",
          stage: "pre_launch",
        },
      }),
    );
    expect(m.required.some((r) => r.id === "supabase")).toBe(false);
    expect(m.suggested.some((s) => s.id === "supabase")).toBe(true);
  });

  it("requires github when product exists", () => {
    const m = runDecisionMatrix(fullResponses());
    expect(m.required.some((r) => r.id === "github")).toBe(true);
  });

  it("requires telegram when Pillar 5 chose telegram", () => {
    const m = runDecisionMatrix(
      fullResponses({ pillar_5: { comm_channel: "telegram" } }),
    );
    expect(m.required.some((r) => r.id === "telegram")).toBe(true);
    expect(m.required.some((r) => r.id === "slack")).toBe(false);
  });

  it("defers twilio-sms when Pillar 5 chose sms (not in registry)", () => {
    const m = runDecisionMatrix(fullResponses({ pillar_5: { comm_channel: "sms" } }));
    expect(m.deferred.some((d) => d.id === "twilio-sms")).toBe(true);
    expect(m.blocked_on_manual_approval.some((b) => b.id === "twilio-sms")).toBe(true);
  });

  it("adds whatsapp when Pillar 5 other contains 'whatsapp'", () => {
    const m = runDecisionMatrix(
      fullResponses({
        pillar_5: { comm_channel: "other", comm_channel_other: "WhatsApp for Board only" },
      }),
    );
    expect(m.required.some((r) => r.id === "whatsapp")).toBe(true);
  });

  it("defers linkedin-sales-nav for outbound GTM profiles", () => {
    const m = runDecisionMatrix(fullResponses());
    expect(m.deferred.some((d) => d.id === "linkedin-sales-nav")).toBe(true);
  });

  it("surfaces Stripe (or stripe-connect) for live-paying companies whose industry has a billing motion", () => {
    // Wavex-os 2026-05: the original "never include stripe" rule is gone.
    // The expanded matrix surfaces Stripe / Stripe Connect via industry-specific
    // rules (consumer_hardware, marketplace, legal_tech, edtech, services_to_saas,
    // b2c) AND via the unknown-industry default fallback for live-paying companies.
    // For an unmapped industry like "b2b_saas" with live_paying_customers,
    // we expect Stripe to appear at minimum as suggested.
    const m = runDecisionMatrix(fullResponses());
    const all = [...m.required, ...m.suggested, ...m.deferred];
    const stripeOrConnect = all.some((e) => e.id === "stripe" || e.id === "stripe-connect");
    expect(stripeOrConnect).toBe(true);
  });

  it("pre-product branches skip product-dependent connectors", () => {
    const m = runDecisionMatrix(
      fullResponses({
        pillar_1: {
          ...fullResponses().pillar_1!,
          has_product: false,
        },
        pillar_3: {
          ...fullResponses().pillar_3!,
          product_state: "idea_only",
        },
      }),
    );
    expect(m.required.some((r) => r.id === "github")).toBe(false);
    expect(m.suggested.some((s) => s.id === "github")).toBe(true);
    expect(m.deferred.some((d) => d.id === "mixpanel")).toBe(true);
  });
});
