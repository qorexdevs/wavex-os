/**
 * Phase 2 · connector_manifest generator.
 *
 *   input:  pillar_responses.json
 *   output: connector_manifest.yaml + connector_manifest.json (both, for
 *           human review and programmatic use)
 *
 * Flow:
 *   1. Run decision-matrix to produce a baseline
 *   2. Ask tier-router T2 to review and revise
 *   3. Parse the T2 JSON; if it fails validation, fall back to the baseline
 *   4. Stamp generated_at/generated_by/hash; write both artifacts to disk
 */

import { createHash } from "node:crypto";
import yaml from "js-yaml";
import { route } from "@op-omega/plugin-tier-router";
import type { PillarResponses } from "../../schema/pillar-responses.js";
import {
  CONNECTOR_MANIFEST_SCHEMA_VERSION,
  type ConnectorManifest,
  type ConnectorEntry,
  type BlockedEntry,
  type ConnectorPriority,
  type ConnectorEntryStatus,
} from "../../schema/connector-manifest.js";
import { runDecisionMatrix } from "./decision-matrix.js";
import { buildPhase2Prompt } from "./prompt.js";
import { writeArtifact } from "../../state/session.js";

// @tunable phase2.valid_priorities
const VALID_PRIORITIES: ConnectorPriority[] = ["P-1", "P0", "P1", "P2"];
// @tunable phase2.valid_statuses
const VALID_STATUSES: ConnectorEntryStatus[] = ["configured", "pending_credential", "pending_decision"];
// Expanded registry — must match the list in `src/phases/phase-2-connector/prompt.ts`.
// Sprint 2b · Lever D extension added industry-specific connectors so T2 can
// surface them per vertical without the validator filtering them out.
// @tunable phase2.registry_ids
const REGISTRY_IDS = new Set([
  // Core 7
  "claude-code", "mixpanel", "slack", "supabase", "github", "telegram", "whatsapp",
  // Industry-specific (original)
  "shopify", "segment", "hubspot", "plaid", "posthog",
  // Deferred-by-default (surfaced when GTM or industry warrants)
  "meta-ads-api", "google-ads-api", "linkedin-sales-nav", "twilio-sms",
  // Wavex-os expansion (2026-05) — broader commercial registry so T2 can
  // adapt the baseline using the rich Pillar 1 enrichment context. Each id
  // here is mirrored in CONNECTOR_KEY_SCHEMA in op-omega-server's credentials
  // route so the Concierge knows how to render the paste UI.
  "stripe", "stripe-connect", "bigcommerce", "shipstation", "klaviyo",
  "salesforce", "intercom", "zendesk", "calendly",
  "notion", "airtable", "linear", "google_calendar", "google_drive", "gmail",
  "discord", "sendgrid", "amplitude",
  "docusign", "clio",
  "openai", "anthropic",
]);

/**
 * Live Composio connection state passed in by the route handler. Each entry
 * augments the manifest's matching `ConnectorEntry`: `status` flips to
 * `configured` and the `composio` block is populated. This is how Phase 5
 * of the Composio integration folds connector plugging into onboarding —
 * once a connector is live, re-running this generator picks it up automatically.
 */
export interface LiveConnectorRow {
  toolkitSlug: string;
  composioConnectionId: string;
  composioAuthConfigId: string | null;
  displayName: string | null;
  scopes: string[] | null;
  connectedAt: Date | null;
}

export interface GenerateConnectorManifestInput {
  companyId: string;
  responses: PillarResponses;
  /** Set true in tests to skip the live T2 call and accept the baseline. */
  skipInference?: boolean;
  now?: Date;
  /**
   * Active Composio connections for this company at generation time. The
   * route handler reads these via `connectorService.listConnections(companyId)`
   * and passes them in. Empty array (or undefined) is the pre-Composio path
   * — manifest entries stay in their decision-matrix `pending_credential`/
   * `pending_decision` state.
   */
  liveConnections?: LiveConnectorRow[];
}

export interface GenerateConnectorManifestResult {
  manifest: ConnectorManifest;
  yamlPath: string;
  jsonPath: string;
  /** "t2" when T2 succeeded, "fallback" when we used decision-matrix only. */
  source: "t2" | "fallback";
  warnings: string[];
}

function hashPillarResponses(r: PillarResponses): string {
  const canon = JSON.stringify({
    schema_version: r.schema_version,
    pillar_1: r.pillar_1,
    pillar_2: r.pillar_2,
    pillar_3: r.pillar_3,
    pillar_4: r.pillar_4,
    pillar_5: r.pillar_5,
  });
  return `sha256:${createHash("sha256").update(canon).digest("hex")}`;
}

function coerceEntry(raw: unknown): ConnectorEntry | null {
  if (typeof raw !== "object" || raw === null) return null;
  const o = raw as Record<string, unknown>;
  const id = typeof o.id === "string" ? o.id : null;
  const priority = typeof o.priority === "string" ? (o.priority as ConnectorPriority) : null;
  // @tunable phase2.rationale_slice
  const rationale = typeof o.rationale === "string" ? o.rationale.slice(0, 240) : null;
  const status = typeof o.status === "string" ? (o.status as ConnectorEntryStatus) : null;
  if (!id || !priority || !rationale || !status) return null;
  if (!VALID_PRIORITIES.includes(priority)) return null;
  if (!VALID_STATUSES.includes(status)) return null;
  const entry: ConnectorEntry = { id, priority, rationale, status };
  if (typeof o.dry_run === "boolean") entry.dry_run = o.dry_run;
  return entry;
}

function coerceBlocked(raw: unknown): BlockedEntry | null {
  if (typeof raw !== "object" || raw === null) return null;
  const o = raw as Record<string, unknown>;
  if (typeof o.id !== "string" || typeof o.reason !== "string") return null;
  // @tunable phase2.blocked_reason_slice
  return { id: o.id, reason: o.reason.slice(0, 300) };
}

function validateT2Manifest(raw: unknown, baseline: ConnectorManifest): ConnectorManifest | null {
  if (typeof raw !== "object" || raw === null) return null;
  const o = raw as Record<string, unknown>;

  const required = Array.isArray(o.required) ? (o.required.map(coerceEntry).filter(Boolean) as ConnectorEntry[]) : null;
  const suggested = Array.isArray(o.suggested) ? (o.suggested.map(coerceEntry).filter(Boolean) as ConnectorEntry[]) : null;
  const deferred = Array.isArray(o.deferred) ? (o.deferred.map(coerceEntry).filter(Boolean) as ConnectorEntry[]) : [];
  const blocked = Array.isArray(o.blocked_on_manual_approval)
    ? (o.blocked_on_manual_approval.map(coerceBlocked).filter(Boolean) as BlockedEntry[])
    : [];

  if (!required || !suggested) return null;

  // Must reference only registry ids (for required + suggested). Drop anything else.
  const requiredFiltered = required.filter((e) => REGISTRY_IDS.has(e.id));
  const suggestedFiltered = suggested.filter((e) => REGISTRY_IDS.has(e.id));
  if (requiredFiltered.length === 0) return null;

  // Required-floor enforcement (Wavex-os 2026-05): every connector the
  // matrix placed in `required` MUST appear in T2's required output. If T2
  // dropped one, restore it from baseline. Prevents T2 hallucinations from
  // removing load-bearing connectors.
  const baselineRequiredIds = new Set(baseline.required.map((e) => e.id));
  const t2RequiredIds = new Set(requiredFiltered.map((e) => e.id));
  const missing: ConnectorEntry[] = [];
  for (const baseEntry of baseline.required) {
    if (!t2RequiredIds.has(baseEntry.id)) missing.push(baseEntry);
  }
  const enforcedRequired = [...requiredFiltered, ...missing];
  // Also de-dupe suggested/deferred against required (T2 might have left a
  // baseline-required connector in a lower bucket; remove the dupe).
  const enforcedRequiredIds = new Set(enforcedRequired.map((e) => e.id));
  const dedupedSuggested = suggestedFiltered.filter((e) => !enforcedRequiredIds.has(e.id));
  const dedupedDeferred = deferred.filter((e) => !enforcedRequiredIds.has(e.id));
  void baselineRequiredIds; // referenced for clarity above

  return {
    schema_version: CONNECTOR_MANIFEST_SCHEMA_VERSION,
    generated_at: baseline.generated_at,
    generated_by: baseline.generated_by,
    based_on: baseline.based_on,
    required: enforcedRequired,
    suggested: dedupedSuggested,
    deferred: dedupedDeferred,
    blocked_on_manual_approval: blocked,
    dry_run_expires_at: baseline.dry_run_expires_at,
  };
}

export async function generateConnectorManifest(
  input: GenerateConnectorManifestInput,
): Promise<GenerateConnectorManifestResult> {
  const warnings: string[] = [];
  const now = input.now ?? new Date();
  const pillarHash = hashPillarResponses(input.responses);

  const baseline = runDecisionMatrix(input.responses, {
    now,
    pillarResponsesHash: pillarHash,
    generatedBy: "T0 · decision-matrix-fallback",
  });

  let manifest: ConnectorManifest = baseline;
  let source: "t2" | "fallback" = "fallback";

  if (!input.skipInference) {
    try {
      const resp = await route({
        agent_id: "onboarding.phase-2",
        prompt: buildPhase2Prompt(input.responses, baseline),
        task_metadata: {
          creativity_required: false,
          customer_facing: false,
          reasoning_depth: "deep",
          priority: "high",
        },
        companyId: input.companyId,
        outputFormat: "json",
        // @tunable phase2.t2_timeout_ms
        timeout_ms: 90_000,
      });
      if (resp.warnings) warnings.push(...resp.warnings);

      const match = resp.output.match(/\{[\s\S]*\}/);
      if (match) {
        const parsed = JSON.parse(match[0]);
        const validated = validateT2Manifest(parsed, baseline);
        if (validated) {
          manifest = { ...validated, generated_by: "T2 · onboarding/phase-2" };
          source = "t2";
        } else {
          warnings.push("T2 response did not validate against manifest shape; kept decision-matrix baseline");
        }
      } else {
        warnings.push("T2 response contained no JSON object; kept decision-matrix baseline");
      }
    } catch (err) {
      warnings.push(
        `T2 generation failed: ${err instanceof Error ? err.message : String(err)}; kept decision-matrix baseline`,
      );
    }
  }

  // Apply live Composio connection state to the manifest entries (Composio
  // integration · Phase 5B). For each entry whose toolkit has an active
  // connection, flip status to 'configured' and populate the `composio` block.
  // Existing activation rules (Phase 3 swarm) key off `status === 'configured'`
  // and resolve standby→active naturally.
  const liveByToolkit = new Map<string, LiveConnectorRow>();
  for (const live of input.liveConnections ?? []) {
    liveByToolkit.set(live.toolkitSlug, live);
  }
  const applyComposioState = (entries: ConnectorEntry[]): ConnectorEntry[] =>
    entries.map((entry) => {
      const live = liveByToolkit.get(entry.id);
      if (!live) return entry;
      return {
        ...entry,
        status: "configured" as const,
        composio: {
          connection_id: live.composioConnectionId,
          auth_config_id: live.composioAuthConfigId,
          // COMPOSIO-016 fix: don't fabricate `now` when connectedAt is null —
          // the manifest is the source of truth for cycle-1 ingestion, and
          // "connected at the moment we re-read the manifest" is incorrect
          // provenance. Omit the field; downstream consumers handle null.
          ...(live.connectedAt ? { connected_at: live.connectedAt.toISOString() } : {}),
          display_name: live.displayName,
          scopes: live.scopes ?? [],
        },
      };
    });

  // Stamp generated_at + generated_by for final artifact
  const finalManifest: ConnectorManifest = {
    ...manifest,
    required: applyComposioState(manifest.required),
    suggested: applyComposioState(manifest.suggested),
    deferred: applyComposioState(manifest.deferred),
    generated_at: now.toISOString(),
    generated_by: source === "t2" ? "T2 · onboarding/phase-2" : "T0 · decision-matrix-fallback",
  };

  const yamlPath = await writeArtifact(
    input.companyId,
    "connector_manifest.yaml",
    yaml.dump(finalManifest, { indent: 2, lineWidth: 100, noRefs: true }),
  );
  const jsonPath = await writeArtifact(
    input.companyId,
    "connector_manifest.json",
    JSON.stringify(finalManifest, null, 2),
  );

  return { manifest: finalManifest, yamlPath, jsonPath, source, warnings };
}
