/**
 * Phase 2 output — connector_manifest.yaml schema (OPΩ-ONB-002 §D).
 *
 * A declarative set of required / suggested / deferred connectors derived
 * from pillar_responses. Required items must be configured before dry_run
 * can flip off. Suggested items are pre-checked but togglable. Deferred
 * items are informational.
 */

export const CONNECTOR_MANIFEST_SCHEMA_VERSION = "1.0";

export type ConnectorPriority = "P-1" | "P0" | "P1" | "P2";
export type ConnectorEntryStatus = "configured" | "pending_credential" | "pending_decision";

/** Live Composio state stamped onto a ConnectorEntry when an active connection
 *  for the toolkit exists. Populated by `phase-2-connector/generate.ts` and the
 *  /onboarding/connector-recommendations route. */
export interface ConnectorEntryComposioState {
  connection_id: string;
  auth_config_id?: string | null;
  /** ISO timestamp; omitted when the upstream connectedAt is null (avoid fabricating). */
  connected_at?: string;
  display_name?: string | null;
  scopes?: string[];
}

export interface ConnectorEntry {
  id: string;
  priority: ConnectorPriority;
  rationale: string;
  status: ConnectorEntryStatus;
  /** When true, this connector is subject to the 14-day dry_run gate on writes. */
  dry_run?: boolean;
  composio?: ConnectorEntryComposioState;
}

export interface BlockedEntry {
  id: string;
  reason: string;
}

export interface ConnectorManifest {
  schema_version: typeof CONNECTOR_MANIFEST_SCHEMA_VERSION;
  generated_at: string;
  /** "T2 · inference/..." or "T0 · decision-matrix-fallback" depending on how it was made. */
  generated_by: string;
  based_on: { pillar_responses_hash: string };
  required: ConnectorEntry[];
  suggested: ConnectorEntry[];
  deferred: ConnectorEntry[];
  blocked_on_manual_approval: BlockedEntry[];
  dry_run_expires_at: string;
}
