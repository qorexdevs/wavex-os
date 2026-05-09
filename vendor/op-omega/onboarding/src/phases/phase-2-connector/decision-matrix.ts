/**
 * Phase 2 decision matrix — deterministic, pure function over pillar_responses.
 *
 * Acts as both the fallback when the T2 call fails AND the baseline the T2
 * call reviews for correctness. Adapted to Operator Ω's current connector
 * registry (mixpanel · slack · supabase · github · telegram · whatsapp) and
 * the user directive that Stripe is not wired (financial data flows via
 * Supabase event tables).
 */

import type { PillarResponses } from "../../schema/pillar-responses.js";
import {
  CONNECTOR_MANIFEST_SCHEMA_VERSION,
  type ConnectorManifest,
  type ConnectorEntry,
  type BlockedEntry,
} from "../../schema/connector-manifest.js";

// @tunable phase2.dry_run_window_days
const DRY_RUN_WINDOW_DAYS = 14;

export interface DecisionMatrixOptions {
  now?: Date;
  pillarResponsesHash?: string;
  generatedBy?: string;
}

export function runDecisionMatrix(
  responses: PillarResponses,
  options: DecisionMatrixOptions = {},
): ConnectorManifest {
  const now = options.now ?? new Date();
  const required: ConnectorEntry[] = [];
  const suggested: ConnectorEntry[] = [];
  const deferred: ConnectorEntry[] = [];
  const blocked: BlockedEntry[] = [];

  // P-1: Claude Code is always required (verified in Pillar 2).
  required.push({
    id: "claude-code",
    priority: "P-1",
    rationale: "Inference bootstrap — verified during Pillar 2.",
    status: responses.pillar_2?.claude_code_verified ? "configured" : "pending_decision",
  });

  const pillar1 = responses.pillar_1;
  const pillar3 = responses.pillar_3;
  const pillar4 = responses.pillar_4;
  const pillar5 = responses.pillar_5;

  const hasProduct = pillar1?.has_product ?? false;
  const livePaying = pillar3?.product_state === "live_paying_customers";

  // Telemetry + financial substrate
  if (livePaying) {
    required.push({
      id: "supabase",
      priority: "P0",
      rationale:
        "Live paying customers — Supabase is the authoritative MRR/NRR source and product-event store. cfo + cdo consume this.",
      status: "pending_credential",
      dry_run: true,
    });
    blocked.push({
      id: "supabase",
      reason:
        "Supabase service-role key grants read+write on all tables. Operator must review + approve dry_run before any writes go live.",
    });
  } else if (hasProduct) {
    suggested.push({
      id: "supabase",
      priority: "P0",
      rationale:
        "Product exists but not yet monetized — Supabase is the right place to stand up the event store before product→revenue kicks in.",
      status: "pending_decision",
      dry_run: true,
    });
  }

  // Alt product telemetry — suggest mixpanel when there's a product, deferred otherwise
  if (hasProduct) {
    suggested.push({
      id: "mixpanel",
      priority: "P1",
      rationale:
        "Alternate product-telemetry source — cdo.signal uses this for anomaly detection beyond what raw Supabase events surface.",
      status: "pending_decision",
    });
  } else {
    deferred.push({
      id: "mixpanel",
      priority: "P2",
      rationale: "No product yet — revisit when Pillar 3 flips to live_paying_customers.",
      status: "pending_decision",
    });
  }

  // Ship-event correlation — GitHub
  if (hasProduct) {
    required.push({
      id: "github",
      priority: "P1",
      rationale:
        "Code-ship → activation correlation. cpo watches merges/deploys; cdo joins ship events to activation cohorts.",
      status: "pending_credential",
    });
  } else if (pillar1 && !hasProduct) {
    // Pre-product — suggest github so future builds can be tracked from day one
    suggested.push({
      id: "github",
      priority: "P1",
      rationale: "Pre-product — suggested so future ship events get tracked from day one.",
      status: "pending_decision",
    });
  }

  // Board communication channel per Pillar 5
  const commChannel = pillar5?.comm_channel;
  if (commChannel === "slack") {
    required.push({
      id: "slack",
      priority: "P0",
      rationale: "Pillar 5 — Board chose Slack for CEO→operator notifications.",
      status: "pending_credential",
      dry_run: false, // notifications are read-only to the target
    });
  } else if (commChannel === "telegram") {
    required.push({
      id: "telegram",
      priority: "P0",
      rationale: "Pillar 5 — Board chose Telegram for CEO→operator notifications.",
      status: "pending_credential",
      dry_run: false,
    });
  } else if (commChannel === "sms") {
    // We don't have a twilio connector yet — flag so the operator knows.
    deferred.push({
      id: "twilio-sms",
      priority: "P1",
      rationale: "Pillar 5 chose SMS but we don't yet ship a Twilio connector. Operator can wire manually or switch Pillar 5 to Telegram/Slack.",
      status: "pending_decision",
    });
    blocked.push({
      id: "twilio-sms",
      reason: "Not implemented in current CONNECTOR_SPECS registry.",
    });
  } else if (commChannel === "email_only") {
    // No messaging connector needed; email via SMTP handled elsewhere
  } else if (commChannel === "other" && pillar5?.comm_channel_other) {
    // Whatsapp-as-other is our most common escape — we do ship a whatsapp spec
    if (pillar5.comm_channel_other.toLowerCase().includes("whatsapp")) {
      required.push({
        id: "whatsapp",
        priority: "P0",
        rationale: "Pillar 5 free-text: WhatsApp. Meta Cloud API supported.",
        status: "pending_credential",
        dry_run: false,
      });
    }
  }

  // GTM profile → outbound extras (deferred because we don't ship those connectors yet)
  const gtm = pillar4?.gtm_profile_enum;
  if (gtm === "OUTBOUND_HIGH_TOUCH_SAAS" || gtm === "OUTBOUND_MID_MARKET") {
    deferred.push({
      id: "linkedin-sales-nav",
      priority: "P2",
      rationale: "Outbound GTM — useful for ICP enrichment once cro.outbound spawns. Wire manually when ready.",
      status: "pending_decision",
    });
  }
  if (gtm === "INBOUND_PLG" || gtm === "INBOUND_MID_TOUCH") {
    deferred.push({
      id: "meta-ads-api",
      priority: "P2",
      rationale: "Inbound-ads lead source — not wired in current registry; flag for future.",
      status: "pending_decision",
    });
    deferred.push({
      id: "google-ads-api",
      priority: "P2",
      rationale: "Inbound-ads lead source — not wired in current registry; flag for future.",
      status: "pending_decision",
    });
  }

  // Industry-specific extended registry (Sprint 2b · Lever D extension).
  // These connectors exist in the spec but aren't in the core registry yet —
  // they're surfaced as deferred P2 and promoted by applyIndustryAdjustments
  // when the operator's industry signal demands them.
  const industry = pillar1?.industry_hint;
  if (industry === "dtc_ecommerce") {
    deferred.push({
      id: "shopify",
      priority: "P2",
      rationale: "DTC ecommerce — Shopify (or Woo) is the store-of-record. Order events + customer entities live here.",
      status: "pending_decision",
    });
  }
  if (industry === "consumer_mobile" || industry === "consumer_ai") {
    deferred.push({
      id: "segment",
      priority: "P2",
      rationale: "Consumer mobile — Segment as the analytics event pipe. cdo.signal joins app events to feature cohorts.",
      status: "pending_decision",
    });
  }
  if (industry === "enterprise_saas" || gtm === "OUTBOUND_HIGH_TOUCH_SAAS") {
    deferred.push({
      id: "hubspot",
      priority: "P2",
      rationale: "Enterprise motion — HubSpot (or Salesforce) is the CRM substrate for account-level telemetry that cro.demo + cro.close feed into.",
      status: "pending_decision",
    });
  }
  if (industry === "fintech" || industry === "fintech_retail" || industry === "healthtech") {
    deferred.push({
      id: "plaid",
      priority: "P2",
      rationale: "Regulated industry — Plaid (or equivalent banking-data provider) is the external-account event source. Audit-compliant by design.",
      status: "pending_decision",
    });
  }
  if (industry === "dev_tools" || industry === "dev_infrastructure") {
    deferred.push({
      id: "posthog",
      priority: "P2",
      rationale: "Dev tools — PostHog self-hosted for product analytics. Dev-native telemetry that complements GitHub activity signals.",
      status: "pending_decision",
    });
  }

  // === LEAD SOURCE ADJUSTMENTS ===
  // Apply after base placement: reshuffle priorities based on how the operator
  // acquires customers. Different lead sources demand different attribution fidelity.
  // Apply lead-source adjustments for every selected channel. Multi-select
  // GTM (e.g. inbound ads + content SEO) unions the connector requirements
  // of both; we iterate so each channel's rule gets to promote its connectors.
  const leadSources = pillar4?.lead_sources ?? (pillar4?.lead_source ? [pillar4.lead_source] : []);
  for (const ls of leadSources) {
    applyLeadSourceAdjustments({ required, suggested, deferred }, ls, hasProduct);
  }

  // === INDUSTRY ADJUSTMENTS (Sprint 2b · Lever D) ===
  // Different industries demand different connector substrates at the same stage.
  // Within-stage pairs converged on identical connector sets until these rules
  // broke the tie on the industry axis.
  applyIndustryAdjustments(
    { required, suggested, deferred },
    pillar1?.industry_hint,
    responses.pillar_3?.product_state === "live_paying_customers",
  );

  const dryRunExpiresAt = new Date(now.getTime() + DRY_RUN_WINDOW_DAYS * 24 * 60 * 60 * 1000);

  return {
    schema_version: CONNECTOR_MANIFEST_SCHEMA_VERSION,
    generated_at: now.toISOString(),
    generated_by: options.generatedBy ?? "T0 · decision-matrix-fallback",
    based_on: { pillar_responses_hash: options.pillarResponsesHash ?? "" },
    required,
    suggested,
    deferred,
    blocked_on_manual_approval: blocked,
    dry_run_expires_at: dryRunExpiresAt.toISOString(),
  };
}

/** Find a connector by id across the three placement buckets. */
function findEntry(
  buckets: { required: ConnectorEntry[]; suggested: ConnectorEntry[]; deferred: ConnectorEntry[] },
  id: string,
): { entry: ConnectorEntry; bucket: "required" | "suggested" | "deferred" } | null {
  for (const bucket of ["required", "suggested", "deferred"] as const) {
    const idx = buckets[bucket].findIndex((e) => e.id === id);
    if (idx >= 0) return { entry: buckets[bucket][idx], bucket };
  }
  return null;
}

/** Move a connector to a different bucket + update its priority + rationale. */
function reassign(
  buckets: { required: ConnectorEntry[]; suggested: ConnectorEntry[]; deferred: ConnectorEntry[] },
  id: string,
  target: "required" | "suggested" | "deferred",
  priority: ConnectorEntry["priority"],
  rationale: string,
): void {
  const found = findEntry(buckets, id);
  if (!found) return;
  if (found.bucket === target && found.entry.priority === priority) return;
  // Remove from current bucket
  const currentIdx = buckets[found.bucket].findIndex((e) => e.id === id);
  const [entry] = buckets[found.bucket].splice(currentIdx, 1);
  // Update fields and push to target
  entry.priority = priority;
  entry.rationale = rationale;
  buckets[target].push(entry);
}

/**
 * Reshuffle connector priorities based on pillar_4.lead_source. Captures the
 * rule that different acquisition motions demand different attribution surfaces:
 *
 *   content_seo          → mixpanel P0 required (attribution is load-bearing for content ROI)
 *   inbound_ads_meta_google → mixpanel P-1 required + meta/google-ads-api surfaced suggested
 *   outbound_cold        → mixpanel stays where it is; supabase rationale tightens
 *   referral_word_of_mouth → mixpanel deprioritized (advocacy loops > funnel metrics)
 *   none_yet             → mixpanel deferred (nothing to measure yet)
 *
 * Rules run AFTER base placement, so they override earlier decisions when
 * pillar_4.lead_source carries a stronger signal than pillar_1.has_product.
 */
function applyLeadSourceAdjustments(
  buckets: { required: ConnectorEntry[]; suggested: ConnectorEntry[]; deferred: ConnectorEntry[] },
  leadSource: string | undefined,
  hasProduct: boolean,
): void {
  if (!leadSource) return;

  switch (leadSource) {
    case "content_seo":
      if (hasProduct) {
        reassign(buckets, "mixpanel", "required", "P0",
          "Content-SEO lead source — content ROI attribution is load-bearing. cdo.attribute joins inbound content → activation cohorts.");
      }
      break;

    case "inbound_ads_meta_google":
      if (hasProduct) {
        reassign(buckets, "mixpanel", "required", "P-1",
          "Inbound-ads lead source — ad-spend attribution is critical. mixpanel is the session-level substrate for cmo.demand + cdo.attribute.");
      }
      // Promote the ad-platform connectors from deferred P2 to suggested P1
      reassign(buckets, "meta-ads-api", "suggested", "P1",
        "Inbound-ads lead source — Meta ad attribution when connector is wired. Wire manually until supported natively.");
      reassign(buckets, "google-ads-api", "suggested", "P1",
        "Inbound-ads lead source — Google ad attribution when connector is wired. Wire manually until supported natively.");
      break;

    case "referral_word_of_mouth":
      // Referrals are relationship-driven — funnel telemetry matters less than
      // advocacy-loop measurement. Mixpanel stays P1 but with a different lens.
      if (hasProduct) {
        reassign(buckets, "mixpanel", "suggested", "P1",
          "Referral-led — mixpanel for expansion-loop measurement. cro.expansion + cmo.advocacy rely on product telemetry to identify champions.");
      }
      break;

    case "outbound_cold":
      // Tighten the mixpanel rationale for outbound context — still P1 suggested
      if (hasProduct) {
        reassign(buckets, "mixpanel", "suggested", "P1",
          "Outbound-led — mixpanel for post-demo activation tracking. cro.demo + cdo.telemetry watch trial conversion after sales-led onboarding.");
      }
      break;

    case "none_yet":
      // No acquisition motion — demote analytics connectors
      reassign(buckets, "mixpanel", "deferred", "P2",
        "No acquisition motion yet — revisit when pillar_4.lead_source flips to an active source.");
      break;
  }
}

/**
 * Industry-aware connector adjustments (Sprint 2b · Lever D).
 *
 * Two operators in the same stage + GTM but different industries should end up
 * with different connector manifests. These rules break the tie on the
 * industry axis by elevating connectors that are structurally critical for
 * specific verticals.
 */
function applyIndustryAdjustments(
  buckets: { required: ConnectorEntry[]; suggested: ConnectorEntry[]; deferred: ConnectorEntry[] },
  industry: string | undefined,
  livePaying: boolean,
): void {
  if (!industry) return;

  // Regulated industries: compliance + audit-trail substrate is load-bearing.
  if (industry === "fintech" || industry === "fintech_retail" || industry === "healthtech" || industry === "legal_tech") {
    reassign(buckets, "supabase", "required", "P-1",
      `Regulated industry (${industry}) — Supabase is the audit-trail substrate. Every write traced, every customer event retained per compliance window.`);
    if (industry === "fintech" || industry === "fintech_retail" || industry === "healthtech") {
      reassign(buckets, "plaid", "suggested", "P1",
        `Regulated industry (${industry}) — Plaid for compliant external-account data. cfo.econ + cdo.attribute use it to reconcile off-platform transactions.`);
    }
  }

  // Dev tools: GitHub is activation surface, not just ship-event tracking.
  if (industry === "dev_tools" || industry === "dev_infrastructure") {
    if (livePaying) {
      reassign(buckets, "github", "required", "P-1",
        `Dev-tools industry — GitHub is where your customers meet your product. cpo.build + cdo.signal use it to measure adoption, not just ship velocity.`);
      reassign(buckets, "posthog", "suggested", "P1",
        `Dev-tools industry — PostHog complements GitHub with product-analytics telemetry. cdo.signal joins event streams to feature adoption.`);
    }
  }

  // DTC ecommerce: ad attribution is load-bearing, not suggested.
  if (industry === "dtc_ecommerce") {
    reassign(buckets, "meta-ads-api", "required", "P0",
      `DTC ecommerce — Meta ad spend drives top of funnel. Attribution is a daily operational requirement, not a nice-to-have.`);
    reassign(buckets, "google-ads-api", "required", "P0",
      `DTC ecommerce — Google ad spend complements Meta. Both attribution surfaces needed for CAC accuracy.`);
    reassign(buckets, "mixpanel", "required", "P-1",
      `DTC ecommerce — activation + retention telemetry is the primary lever. Mixpanel joins ad spend to customer LTV.`);
    reassign(buckets, "shopify", "required", "P0",
      `DTC ecommerce — Shopify is the store-of-record. Order events + customer entities + fulfillment status flow from here into every downstream bundle.`);
  }

  // Consumer mobile: analytics is primary, not secondary.
  if (industry === "consumer_mobile" || industry === "consumer_ai") {
    reassign(buckets, "mixpanel", "required", "P-1",
      `Consumer mobile — activation funnel is the product. Mixpanel is the session-level substrate for cpo.growth + cdo.signal.`);
    reassign(buckets, "segment", "suggested", "P0",
      `Consumer mobile — Segment fans out in-app events to Mixpanel, warehouse, and attribution partners. Standardizes cdo.telemetry upstream.`);
  }

  // Enterprise SaaS: slack routing for account-team coordination.
  if (industry === "enterprise_saas") {
    // Supabase stays required; the rationale shifts to enterprise audit expectations.
    const found = findEntry(buckets, "supabase");
    if (found && found.bucket === "required") {
      reassign(buckets, "supabase", "required", found.entry.priority,
        `Enterprise SaaS — account-level events + CRM sync flow through Supabase. CSMs consume its event streams to flag expansion and churn risk.`);
    }
    reassign(buckets, "hubspot", "suggested", "P0",
      `Enterprise SaaS — HubSpot is the CRM substrate. cro.demo + cro.close + cro.expansion all feed off account-level pipeline state that lives here.`);
  }

  // Open-core: GitHub stars + community activity feed into signal detection.
  if (industry === "dev_tools") {
    const foundGh = findEntry(buckets, "github");
    if (foundGh) {
      // Keep existing priority; sharpen rationale.
      reassign(buckets, "github", foundGh.bucket, foundGh.entry.priority,
        `Open-core dev-tools — GitHub activity (stars, issues, contributors) is a community-growth signal. cdo.signal treats it as a first-class telemetry source.`);
    }
  }
}
