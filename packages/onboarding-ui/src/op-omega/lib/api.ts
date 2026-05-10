/** Op-omega onboarding API client. Wraps fetch to /op-omega/* and
 *  /api/instance/* routes registered by @wavex-os/op-omega-server.
 *
 *  Payload shapes match the vendored upstream contract verbatim
 *  (snake_case fields like org_name, company_context, etc.).
 *
 *  Production: swap fetch base URL via vite proxy override; function
 *  signatures stay identical. */

import type {
  CompanyManifest, ConnectorManifest, PillarResponses,
  Pillar1Response, Pillar2Outcome, Pillar3Response, Pillar4Response, Pillar5Response,
  SwarmManifest, WorkflowManifest, OnboardingHaltPayload,
  ProductState, GtmProfileEnum, CommChannel, UrgencyRouting, LeadSource, SalesMotion, CloseChannel,
} from "@op-omega/plugin-onboarding";

const BASE = ""; // vite proxies /op-omega and /api directly

export class ApiError extends Error {
  constructor(message: string, public status?: number, public halt?: OnboardingHaltPayload) {
    super(message);
    this.name = "ApiError";
  }
}

async function call<T>(method: string, path: string, body?: unknown): Promise<T> {
  const init: RequestInit = { method };
  if (body !== undefined) {
    init.headers = { "Content-Type": "application/json" };
    init.body = JSON.stringify(body);
  }
  const resp = await fetch(`${BASE}${path}`, init);
  const json = await resp.json().catch(() => ({})) as Record<string, unknown>;
  if (!resp.ok || json.ok === false) {
    const halt = (json as { halt?: OnboardingHaltPayload }).halt;
    const message = halt?.operator_message
      ?? (json.error as string | undefined)
      ?? `HTTP ${resp.status}`;
    throw new ApiError(message, resp.status, halt);
  }
  return json as T;
}

export interface StatusResponse {
  ok: boolean;
  companyId: string;
  responses: PillarResponses;
  complete: boolean;
  next_pillar: 1 | 2 | 3 | 4 | 5 | null;
}

export interface ProbeResponse {
  ok: boolean;
  probe?: {
    installed: boolean;
    authenticated: boolean;
    version?: string;
    test_output?: string;
    error?: string;
  };
  error?: string;
}

export interface InstanceManifestResponse {
  ok: boolean;
  manifest?: CompanyManifest;
  error?: string;
}

export interface InstanceKpisResponse {
  ok: boolean;
  companyId: string;
  kpis: Array<{
    kpiId: string;
    label: string;
    direction: "higher_is_better" | "lower_is_better";
    ownerRole?: string;
    currentValue?: number;
    targetMicros?: number;
    windowDays?: number;
  }>;
}

export interface CompaniesResponse { ok: boolean; companies: Array<{ id: string; name: string }>; }

export const opOmegaOnboardingApi = {
  // Status
  status: (companyId: string) =>
    call<StatusResponse>("GET", `/op-omega/onboarding/status?companyId=${encodeURIComponent(companyId)}`),

  // Pillars — upstream snake_case payload shapes
  pillar1: (input: {
    companyId: string;
    org_name: string;
    raw_input: string;
    manual_context?: string;
  }) => call<{ ok: true; response: Pillar1Response }>(
    "POST", "/op-omega/onboarding/pillar/1", input,
  ),

  pillar2: (input: {
    companyId: string;
    claude_plan: "max_20x" | "max_5x" | "api_only" | "other";
    claude_plan_other_note?: string;
  }) => call<Pillar2Outcome>("POST", "/op-omega/onboarding/pillar/2", input),

  pillar3: (input: {
    companyId: string;
    product_state: ProductState;
    product_state_other?: string;
    stage: string;
    stage_other?: string;
  }) => call<{ ok: true; response: Pillar3Response }>(
    "POST", "/op-omega/onboarding/pillar/3", input,
  ),

  pillar4: (input: {
    companyId: string;
    lead_sources: LeadSource[];
    lead_source_other?: string;
    sales_motion: SalesMotion;
    sales_motion_other?: string;
    close_channel?: CloseChannel;
    close_channel_other?: string;
  }) => call<{ ok: true; response: Pillar4Response }>(
    "POST", "/op-omega/onboarding/pillar/4", input,
  ),

  pillar5: (input: {
    companyId: string;
    comm_channel: CommChannel;
    comm_channel_other?: string;
    urgency_routing?: UrgencyRouting;
    urgency_routing_other?: string;
    board_endpoint_config?: Record<string, string>;
  }) => call<{ ok: true; response: Pillar5Response }>(
    "POST", "/op-omega/onboarding/pillar/5", input,
  ),

  pillar5TestSend: (input: {
    companyId: string;
    channel: "telegram" | "slack" | "sms" | "email_only";
    config: Record<string, string>;
  }) => call<{ ok: boolean; detail: string }>(
    "POST", "/op-omega/onboarding/pillar/5/test-send", input,
  ),

  // Credential Concierge
  listCredentials: (companyId: string) =>
    call<{
      ok: true;
      companyId: string;
      connectors: Array<{
        connectorId: string;
        bucket: "required" | "suggested" | "deferred";
        priority: string;
        rationale: string;
        status: "vaulted_valid" | "vaulted_unvalidated" | "skipped" | "pending";
        vaultedKeys: string[];
        expectedKeys: string[];
        hasProbe: boolean;
        lastTestedAt: string | null;
        lastTestResult: { ok: boolean; detail?: string } | null;
        skipReason: string | null;
        composioManaged: boolean;
      }>;
      progress: { requiredCount: number; requiredReady: number; allRequiredAddressed: boolean };
    }>("GET", `/op-omega/onboarding/credentials/${encodeURIComponent(companyId)}`),

  pasteCredential: (input: {
    companyId: string; connectorId: string; key: string; plaintext: string;
  }) => call<{ ok: true; vaultedAt: string }>(
    "POST", "/op-omega/onboarding/credentials/paste", input,
  ),

  testCredential: (input: { companyId: string; connectorId: string }) =>
    call<{ ok: boolean; detail: string }>(
      "POST", "/op-omega/onboarding/credentials/test", input,
    ),

  skipCredential: (input: { companyId: string; connectorId: string; reason: string }) =>
    call<{ ok: true }>(
      "POST", "/op-omega/onboarding/credentials/skip", input,
    ),

  // Probes
  claudeCodeCheck: () => call<ProbeResponse>("GET", "/op-omega/onboarding/claude-code-check"),

  // Phases
  generateConnector: (companyId: string, skipInference = false) =>
    call<{ ok: true; manifest: ConnectorManifest; source: "t2" | "fallback"; warnings: string[] }>(
      "POST", "/op-omega/onboarding/connector-manifest", { companyId, skipInference }),

  generateSwarm: (companyId: string, skipInference = false) =>
    call<{ ok: true; manifest: SwarmManifest; source: "t2" | "fallback"; warnings: string[] }>(
      "POST", "/op-omega/onboarding/swarm-manifest", { companyId, skipInference }),

  generateWorkflow: (companyId: string, opts: { skipInference?: boolean; bypassBudgetCheck?: boolean } = {}) =>
    call<{ ok: true; manifest: WorkflowManifest; source: "t2" | "fallback"; warnings: string[] }>(
      "POST", "/op-omega/onboarding/workflow-manifest", { companyId, ...opts }),

  // Load existing phase manifests from disk — no T2 cost. Returns
  // { exists: false, manifest: null } if the phase hasn't been generated yet.
  loadConnector: (companyId: string) =>
    call<{ ok: true; exists: boolean; manifest: ConnectorManifest | null; source?: "loaded" }>(
      "GET", `/op-omega/onboarding/connector-manifest?companyId=${encodeURIComponent(companyId)}`),

  loadSwarm: (companyId: string) =>
    call<{ ok: true; exists: boolean; manifest: SwarmManifest | null; source?: "loaded" }>(
      "GET", `/op-omega/onboarding/swarm-manifest?companyId=${encodeURIComponent(companyId)}`),

  loadWorkflow: (companyId: string) =>
    call<{ ok: true; exists: boolean; manifest: WorkflowManifest | null; source?: "loaded" }>(
      "GET", `/op-omega/onboarding/workflow-manifest?companyId=${encodeURIComponent(companyId)}`),

  connectorRecommendations: (companyId: string) =>
    call<{ ok: true; manifest: ConnectorManifest; source: "t2" | "fallback"; warnings: string[] }>(
      "GET", `/op-omega/onboarding/connector-recommendations?companyId=${encodeURIComponent(companyId)}`),

  // Finalize
  finalize: (input: {
    companyId: string;
    orgId?: string;
    operatorHandle?: string;
    skipInference?: boolean;
    mc?: { horizon_cycles?: number; n_runs?: number; seed?: number };
  }) => call<{
    ok: true;
    manifest: CompanyManifest;
    sha256: string;
    source: "t2" | "fallback";
    warnings: string[];
  }>("POST", "/op-omega/onboarding/finalize", input),

  // Re-generate imprint with optional operator guidance (prose only)
  regenerateImprint: (input: { companyId: string; operatorGuidance?: string }) =>
    call<{
      ok: true;
      manifest: CompanyManifest;
      sha256: string;
      source: "t2" | "fallback";
      warnings: string[];
    }>("POST", "/op-omega/onboarding/regenerate-imprint", input),

  // Refinement (Option C): analyze guidance, propose structural changes,
  // operator approves a subset, apply surgically + re-sign.
  analyzeRefinement: (input: { companyId: string; operatorGuidance: string }) =>
    call<{
      ok: true;
      imprint_only: boolean;
      changes: Array<{
        id: string;
        action: "connector_add" | "connector_promote" | "swarm_overlay" | "workflow_task_add" | "workflow_escalation_add";
        rationale: string;
        pillar_signal?: string;
        // action-specific fields (kept loose — UI renders generically)
        connector_id?: string;
        bucket?: "required" | "suggested" | "deferred";
        priority?: "P-1" | "P0" | "P1" | "P2";
        from_bucket?: "deferred" | "suggested";
        to_bucket?: "suggested" | "required";
        slot?: string;
        new_overlay?: string;
        task?: { task: string; tier?: string; flow_type?: string; connector?: string | null; dry_run_gate?: boolean };
        on?: string;
        to?: string;
      }>;
      rationale_summary: string;
      warnings: string[];
    }>("POST", "/op-omega/onboarding/analyze-refinement", input),

  applyRefinement: (input: {
    companyId: string;
    operatorGuidance: string;
    changes: unknown[];
    regenerateImprint?: boolean;
  }) => call<{
    ok: true;
    sha256: string;
    manifest: CompanyManifest;
    applied_change_ids: string[];
    warnings: string[];
  }>("POST", "/op-omega/onboarding/apply-refinement", input),

  revertRefinement: (input: { companyId: string }) =>
    call<{
      ok: true;
      sha256: string;
      reverted_guidance: string;
      reverted_change_ids: string[];
    }>("POST", "/op-omega/onboarding/revert-refinement", input),

  // Instance reads (dashboard)
  getInstanceManifest: (companyId: string) =>
    call<InstanceManifestResponse>("GET", `/api/instance/${encodeURIComponent(companyId)}/manifest`),

  getInstanceKpis: (companyId: string) =>
    call<InstanceKpisResponse>("GET", `/api/instance/${encodeURIComponent(companyId)}/kpis`),

  listCompanies: () =>
    call<CompaniesResponse>("GET", "/api/companies"),

  // Activate — bridge the signed manifest into runtime DB state. Idempotent.
  activate: (companyId: string) =>
    call<{
      ok: true;
      inserted: { companies: number; agents: number };
      warnings: string[];
    }>("POST", `/api/instance/${encodeURIComponent(companyId)}/activate`),

  // Swap — record an operator-chosen template substitution for one slot.
  // Pass templateId=null to clear (revert to catalog default).
  swapTemplate: (input: { companyId: string; slot: string; templateId: string | null }) =>
    call<{
      ok: true;
      slot: string;
      templateId: string | null;
      overlays: Record<string, string>;
      sha256: string;
    }>("POST", `/api/instance/${encodeURIComponent(input.companyId)}/swap-template`, {
      slot: input.slot, templateId: input.templateId,
    }),

  // Add agent — creates a new agent slot under an existing parent.
  // Persists to manifest.template_additions; bridge merges on activate.
  addAgent: (input: { companyId: string; parent_slot: string; template_id: string; slot_suffix?: string }) =>
    call<{
      ok: true;
      added: { slot: string; parent_slot: string; template_id: string; added_at: string };
      additions: Array<{ slot: string; parent_slot: string; template_id: string; added_at: string }>;
      sha256: string;
    }>("POST", `/api/instance/${encodeURIComponent(input.companyId)}/add-agent`, {
      parent_slot: input.parent_slot, template_id: input.template_id, slot_suffix: input.slot_suffix,
    }),

  // Remove an operator-added agent (no-op if it's a base-roster slot).
  removeAddedAgent: (input: { companyId: string; slot: string }) =>
    call<{ ok: true; removed_slot: string; sha256: string }>(
      "DELETE", `/api/instance/${encodeURIComponent(input.companyId)}/add-agent`, { slot: input.slot },
    ),

  // Reset — wipe ALL state for a company (filesystem onboarding artifacts +
  // every DB row keyed by company_id). Destructive. UI must confirm.
  resetCompany: (companyId: string) =>
    call<{
      ok: true;
      companyId: string;
      filesystemRemoved: boolean;
      dbDeletedRows: {
        companies: number;
        agents: number;
        credentials: number;
        credentialAuditLog: number;
        companyKpis: number;
        kpiSnapshots: number;
        costEvents: number;
        issues: number;
        issueComments: number;
        taskOutcomeAttributions: number;
        heartbeatRuns: number;
      };
    }>("DELETE", `/api/instance/${encodeURIComponent(companyId)}/reset`),
};
