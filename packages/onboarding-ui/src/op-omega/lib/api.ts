/** Op-omega onboarding API client. Wraps fetch to /op-omega/onboarding/*
 * routes registered by mock-core in PR 18. The routes already follow
 * op-omega's path conventions; this client is only a typed surface.
 *
 * Production: swap fetch base URL from /api/paperclip (Vite proxy → mock-core)
 * to https://api.wavex-os.com. Function signatures stay identical. */

import type {
  CompanyManifest, ConnectorManifest, OnboardingEvent, PillarResponses,
  Pillar1Response, Pillar2Response, Pillar3Response, Pillar4Response, Pillar5Response,
  SwarmManifest, WorkflowManifest, OnboardingHaltPayload,
} from "@op-omega/plugin-onboarding";

const BASE = ""; // op-omega routes proxied directly via /op-omega/* in vite.config.ts

interface OkEnvelope<T> { ok: true; [k: string]: unknown; }
interface HaltEnvelope { ok: false; halt: OnboardingHaltPayload; }
interface ErrorEnvelope { ok: false; error: string; }

class ApiError extends Error {
  constructor(message: string, public status?: number, public halt?: OnboardingHaltPayload) {
    super(message);
    this.name = "ApiError";
  }
}

async function call<T>(method: string, path: string, body?: unknown): Promise<T> {
  const resp = await fetch(`${BASE}${path}`, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await resp.json().catch(() => ({})) as Record<string, unknown>;
  if (!resp.ok || json.ok === false) {
    const halt = (json as { halt?: OnboardingHaltPayload }).halt;
    const message = halt?.operator_message ?? (json.error as string | undefined) ?? `HTTP ${resp.status}`;
    throw new ApiError(message, resp.status, halt);
  }
  return json as T;
}

export interface StatusResponse {
  ok: boolean;
  companyId: string;
  next_pillar: 1 | 2 | 3 | 4 | 5 | null;
  phase_1_complete: boolean;
  has_connector_manifest: boolean;
  has_swarm_manifest: boolean;
  has_workflow_manifest: boolean;
  has_company_manifest: boolean;
  pillar_responses: PillarResponses;
  complete: boolean;
}

export const opOmegaOnboardingApi = {
  // Companies
  listCompanies: () => call<{ companies: string[] }>("GET", "/op-omega/onboarding/companies"),
  createCompany: (companyId: string) => call<OkEnvelope<unknown>>("POST", "/op-omega/onboarding/companies", { companyId }),

  // Status
  status: (companyId: string) => call<StatusResponse>("GET", `/op-omega/onboarding/status?companyId=${encodeURIComponent(companyId)}`),

  // Pillars
  pillar1: (input: {
    companyId: string;
    companyName: string; industry: string;
    companyContext?: string; businessModel?: string;
    icp?: string; positioning?: string; tone?: string;
    enrichWithAI?: boolean;
  }) => call<{ ok: true; pillar1: Pillar1Response; next_pillar: 2; inference_latency_ms?: number }>(
    "POST", "/op-omega/onboarding/pillar/1", input,
  ),

  pillar2: (input: { companyId: string }) => call<{
    ok: boolean; pillar2: Pillar2Response; next_pillar: 3 | null; fix_hint?: string;
  }>("POST", "/op-omega/onboarding/pillar/2", input),

  pillar3: (input: {
    companyId: string;
    product_state: Pillar3Response["product_state"];
    stage: Pillar3Response["stage"];
    goalKpiId: string; goalCurrent: number; goalTarget: number; goalWindowDays: number;
  }) => call<{ ok: true; pillar3: Pillar3Response; next_pillar: 4 }>(
    "POST", "/op-omega/onboarding/pillar/3", input,
  ),

  pillar4: (input: {
    companyId: string;
    lead_sources: string[];
    sales_motion?: string;
    gtm_profile_enum?: Pillar4Response["gtm_profile_enum"];
    gtm_profile_other?: string;
  }) => call<{ ok: true; pillar4: Pillar4Response; next_pillar: 5 }>(
    "POST", "/op-omega/onboarding/pillar/4", input,
  ),

  pillar5: (input: {
    companyId: string;
    comm_channel: Pillar5Response["comm_channel"];
    urgency_routing?: Pillar5Response["urgency_routing"];
    telegram_bot_token?: string;
    telegram_chat_id?: string;
  }) => call<{ ok: true; pillar5: Pillar5Response; next_phase: string }>(
    "POST", "/op-omega/onboarding/pillar/5", input,
  ),

  pillar5TestSend: (input: { companyId: string; bot_token?: string; chat_id?: string; message?: string }) =>
    call<{ ok: boolean; detail: string }>("POST", "/op-omega/onboarding/pillar/5/test-send", input),

  // Phases
  generateConnector: (companyId: string) =>
    call<{ ok: true; manifest: ConnectorManifest }>("POST", "/op-omega/onboarding/generate/connector", { companyId }),
  generateSwarm: (companyId: string) =>
    call<{ ok: true; manifest: SwarmManifest }>("POST", "/op-omega/onboarding/generate/swarm", { companyId }),
  generateWorkflow: (companyId: string) =>
    call<{ ok: true; manifest: WorkflowManifest }>("POST", "/op-omega/onboarding/generate/workflow", { companyId }),
  connectorRecommendations: (companyId: string) =>
    call<{ ok: true; manifest: ConnectorManifest }>("GET", `/op-omega/onboarding/connector-recommendations?companyId=${encodeURIComponent(companyId)}`),

  // Verify + Finalize
  verifyKpis: (companyId: string, verifications: Array<{ kpiId: string; verified: boolean }>) =>
    call<{ ok: true }>("POST", "/op-omega/onboarding/kpi-verify", { companyId, verifications }),
  complete: (companyId: string) =>
    call<{ ok: true; manifest: CompanyManifest; sha256: string; files: string[] }>("POST", "/op-omega/onboarding/complete", { companyId }),
  materialize: (companyId: string) =>
    call<{ ok: true; created: string[]; updated: string[]; skipped: string[] }>("POST", "/op-omega/onboarding/materialize", { companyId }),
  loopStatus: (companyId: string) =>
    call<{ ok: boolean; agents_ready: number; total_agents: number }>("GET", `/op-omega/onboarding/loop-status?companyId=${encodeURIComponent(companyId)}`),

  // Manifests
  getManifest: (companyId: string) =>
    call<{ ok: true; manifest: CompanyManifest }>("GET", `/op-omega/onboarding/manifest?companyId=${encodeURIComponent(companyId)}`),

  // Credentials
  credentialsList: (companyId: string) =>
    call<{ ok: true; companyId: string; keys: string[] }>("GET", `/op-omega/onboarding/credentials?companyId=${encodeURIComponent(companyId)}`),
  credentialsPaste: (input: { companyId: string; key: string; plaintext: string }) =>
    call<{ ok: true; key: string; setAt: string }>("POST", "/op-omega/onboarding/credentials/paste", input),
  credentialsSkip: (input: { companyId: string; key: string }) =>
    call<{ ok: true; key: string; status: "skipped" }>("POST", "/op-omega/onboarding/credentials/skip", input),

  // Events
  listEvents: (companyId: string) =>
    call<{ ok: true; companyId: string; events: OnboardingEvent[] }>("GET", `/op-omega/onboarding/events?companyId=${encodeURIComponent(companyId)}`),

  // Test ergonomics
  resetInstance: (companyId: string) =>
    call<{ ok: true; companyId: string }>("DELETE", `/op-omega/onboarding/instance/${encodeURIComponent(companyId)}`),
};

export { ApiError };
