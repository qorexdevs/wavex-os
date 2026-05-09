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

  // Instance reads (dashboard)
  getInstanceManifest: (companyId: string) =>
    call<InstanceManifestResponse>("GET", `/api/instance/${encodeURIComponent(companyId)}/manifest`),

  getInstanceKpis: (companyId: string) =>
    call<InstanceKpisResponse>("GET", `/api/instance/${encodeURIComponent(companyId)}/kpis`),

  listCompanies: () =>
    call<CompaniesResponse>("GET", "/api/companies"),
};
