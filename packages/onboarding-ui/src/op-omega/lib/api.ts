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

  pillar1Edit: (input: {
    companyId: string;
    industry_hint?: string;
    business_model_hint?: string;
    has_product?: boolean;
  }) => call<{ ok: true; response: Pillar1Response }>(
    "POST", "/op-omega/onboarding/pillar/1/edit", input,
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
        keysUrl: string | null;
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

  // Sub-fleet scope — written before swarm-manifest so the route can park
  // non-selected divisions. mode="full" keeps everything active.
  setScope: (input: {
    companyId: string;
    mode: "full" | "focused";
    departments: string[];
    custom_labels?: string[];
  }) => call<{ ok: true; scope: { mode: string; departments: string[]; custom_labels?: string[]; set_at: string } }>(
    "POST", "/op-omega/onboarding/scope", input,
  ),

  getScope: (companyId: string) =>
    call<{ ok: true; scope: { mode: "full" | "focused"; departments: string[]; custom_labels?: string[]; set_at: string } | null }>(
      "GET", `/op-omega/onboarding/scope?companyId=${encodeURIComponent(companyId)}`),

  // Avatar onboarding (parallel track to the company pillars)
  createAvatar: (input: { name: string; role: string; workingHours: [string, string]; tz: string }) =>
    call<{ ok: true; avatarId: string }>("POST", "/op-omega/onboarding/avatar", input),

  connectAvatarTool: (avatarId: string, provider: string) =>
    call<{
      ok: true;
      connected: Array<{ provider: string; ref: string; status: "stub" | "connected"; connected_at: string }>;
      total: number;
    }>("POST", `/op-omega/onboarding/avatar/${encodeURIComponent(avatarId)}/tools`, { provider }),

  // Phase 3 — per-provider personalization (VIPs / privacy zones / signoff)
  setAvatarToolMeta: (
    avatarId: string, provider: string,
    meta: { vips?: string[]; privacy_zones?: string[]; signoff?: string },
  ) =>
    call<{
      ok: true; provider: string;
      meta: { vips?: string[]; privacy_zones?: string[]; signoff?: string };
    }>(
      "POST",
      `/op-omega/onboarding/avatar/${encodeURIComponent(avatarId)}/tools/${encodeURIComponent(provider)}/meta`,
      meta,
    ),

  analyzeAvatarVoice: (
    avatarId: string,
    samples: [string, string, string],
    skipInference?: boolean,
    extras?: { signoff?: string; guardrails?: string[] },
  ) =>
    call<{
      ok: true;
      profile: { tone: string; formality: string; structure: string; delegates: string[] };
      source: "t2" | "stub";
      signoff?: string;
      guardrails?: string[];
    }>(
      "POST",
      `/op-omega/onboarding/avatar/${encodeURIComponent(avatarId)}/voice`,
      { samples, skipInference, ...extras },
    ),

  // Phase 3 — Trust & boundaries step
  setAvatarTrust: (avatarId: string, trust: {
    autonomy_preset: "cautious" | "balanced" | "aggressive";
    vips: Array<{ email: string; label?: string }>;
    privacy_zones: string[];
    notify: string[];
  }) =>
    call<{
      ok: true;
      trust: typeof trust & { set_at: string };
    }>("POST", `/op-omega/onboarding/avatar/${encodeURIComponent(avatarId)}/trust`, trust),

  getAvatarTrust: (avatarId: string) =>
    call<{
      ok: true;
      trust: {
        autonomy_preset: "cautious" | "balanced" | "aggressive";
        vips: Array<{ email: string; label?: string }>;
        privacy_zones: string[];
        notify: string[];
        set_at: string;
      } | null;
    }>("GET", `/api/avatar/${encodeURIComponent(avatarId)}/trust`),

  graduateAvatar: (avatarId: string) =>
    call<{
      ok: true;
      trust: {
        autonomy_preset: "cautious" | "balanced" | "aggressive";
        vips: Array<{ email: string; label?: string }>;
        privacy_zones: string[];
        notify: string[];
        set_at: string;
      };
    }>("POST", `/api/avatar/${encodeURIComponent(avatarId)}/graduate`),

  getAvatarSuggestions: (avatarId: string) =>
    call<{
      ok: true;
      suggestions: Array<{ id: string; title: string; body: string; needs: string[] }>;
    }>("GET", `/op-omega/onboarding/avatar/${encodeURIComponent(avatarId)}/suggestions`),

  finalizeAvatar: (avatarId: string, enabledAutomationIds: string[]) =>
    call<{
      ok: true;
      avatarId: string;
      url: string;
      paperclipHandoff: {
        enabled: boolean;
        paperclipUrl: string | null;
        paperclipCompanyId: string | null;
        conductorAgentId: string | null;
        created: Array<{ provider: string; agentId: string; status: string }>;
        skipped: Array<{ provider: string; reason: string }>;
        errors: Array<{ provider: string; message: string }>;
      } | null;
    }>(
      "POST", `/op-omega/onboarding/avatar/${encodeURIComponent(avatarId)}/finalize`,
      { enabledAutomationIds },
    ),

  // Phase 2 — manual triage trigger (dev surface; scheduler fires this
  // automatically in prod). Returns the runner's report.
  runAvatarGmailTriage: (avatarId: string, opts?: { dryRun?: boolean; skipInference?: boolean }) => {
    const params = new URLSearchParams();
    if (opts?.dryRun === false) params.set("dryRun", "false");
    if (opts?.skipInference === false) params.set("skipInference", "false");
    const qs = params.toString();
    return call<{
      ok: true;
      result: {
        avatarId: string; paperclipCompanyId: string; gmailAgentId: string | null;
        processed: number; drafted: number; approvalsCreated: number;
        errors: Array<{ threadId: string; message: string }>;
      };
    }>("POST", `/api/avatar/${encodeURIComponent(avatarId)}/run/gmail-triage${qs ? "?" + qs : ""}`);
  },

  // Phase 2 — approval inbox
  listAvatarApprovals: (avatarId: string, status: "pending" | "approved" | "rejected" | "all" = "pending") =>
    call<{
      ok: true;
      approvals: Array<{
        id: string;
        avatarId: string;
        type: string;
        status: "pending" | "approved" | "rejected";
        createdAt: string;
        decidedAt?: string;
        decisionNote?: string;
        requestedByAgentId: string;
        payload: {
          threadId: string;
          subject: string;
          from: { name: string; email: string };
          preview: string;
          receivedAt: string;
          draftText: string | null;
          classification: "now" | "soon" | "fyi";
          confidence: number;
          reasoning: string;
          openQuestion: string | null;
        };
        editedPayload?: { draftText?: string } | null;
      }>;
    }>("GET", `/api/avatar/${encodeURIComponent(avatarId)}/approvals?status=${status}`),

  decideAvatarApproval: (
    avatarId: string,
    approvalId: string,
    body: { decision: "approve" | "reject"; decisionNote?: string; editedPayload?: { draftText?: string } },
  ) =>
    call<{ ok: true; approval: { id: string; status: string; decidedAt: string } }>(
      "POST",
      `/api/avatar/${encodeURIComponent(avatarId)}/approvals/${encodeURIComponent(approvalId)}/decide`,
      body,
    ),

  // Phase 2 — audit log
  getAvatarAudit: (avatarId: string, limit = 50) =>
    call<{
      ok: true;
      entries: Array<{
        id: string;
        actorType: string;
        actorId: string;
        action: string;
        entityType: string;
        entityId: string;
        agentId: string | null;
        details: Record<string, unknown> | null;
        createdAt: string;
      }>;
      error?: string;
    }>("GET", `/api/avatar/${encodeURIComponent(avatarId)}/audit?limit=${limit}`),

  // Phase 2 — per-skill kill switch (pause/resume one sub-agent on the
  // mirrored Paperclip company without touching the rest of the fleet)
  listAvatarSkills: (avatarId: string) =>
    call<{
      ok: true;
      skills: Array<{ skill: string; agentId: string; status: string | null }>;
    }>("GET", `/api/avatar/${encodeURIComponent(avatarId)}/skills`),

  controlAvatarSkill: (avatarId: string, skill: string, action: "pause" | "resume") =>
    call<{ ok: true; skill: string; agentId: string; status: string | null }>(
      "POST",
      `/api/avatar/${encodeURIComponent(avatarId)}/skills/${encodeURIComponent(skill)}/control`,
      { action },
    ),

  getAvatar: (avatarId: string) =>
    call<{
      ok: true;
      avatarId: string;
      profile: { name: string; role: string; working_hours: [string, string]; tz: string; created_at: string } | null;
      tools: Array<{ provider: string; ref: string; status: "stub" | "connected"; connected_at: string }>;
      tools_skipped: boolean;
      voice: {
        samples: string[];
        profile?: { tone: string; formality: string; structure: string; delegates: string[] };
        source?: "t2" | "stub";
      } | null;
      automations: { enabled: string[]; suggested: Array<{ id: string; title: string; body: string; needs: string[] }> } | null;
    }>("GET", `/api/avatar/${encodeURIComponent(avatarId)}`),

  // Monte Carlo report (full per-strategy breakdown, written by finalize)
  getMcReport: (companyId: string) =>
    call<{
      ok: boolean;
      report?: {
        horizon_cycles: number;
        n_runs_per_strategy: number;
        strategies: Array<{ strategy_id: string; mean_mrr_growth: number; p_ruin: number; sharpe: number }>;
        winner: { strategy_id: string; rationale: string };
      };
      error?: string;
    }>("GET", `/op-omega/onboarding/mc-report?companyId=${encodeURIComponent(companyId)}`),

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

  // Real-time Paperclip handoff progress — polled by ActivateProgress
  // while /activate is in flight so the UI can paint per-slot hires
  // as the bridge actually fires them, not just at the final response.
  getHandoffStatus: (companyId: string) =>
    call<{
      ok: true;
      progress: null | {
        paperclipUrl: string;
        paperclipCompanyId: string;
        total: number;
        completed: number;
        inFlight: string | null;
        slots: Array<{ slot: string; status: "pending" | "hiring" | "hired" | "skipped" | "failed"; agentId?: string }>;
      };
    }>("GET", `/api/instance/${encodeURIComponent(companyId)}/handoff-status`),

  // Activate — bridge the signed manifest into runtime DB state. Idempotent.
  activate: (companyId: string) =>
    call<{
      ok: true;
      inserted: { companies: number; agents: number };
      warnings: string[];
      sha256: string;
      paperclipHandoff: {
        enabled: boolean;
        paperclipUrl: string | null;
        paperclipCompanyId: string | null;
        created: Array<{ slot: string; agentId: string; status: string }>;
        skipped: Array<{ slot: string; reason: string }>;
        errors: Array<{ slot: string; message: string }>;
      };
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

  // Natural-language recommendation for the Add-agent flow. T2 reads the
  // 165-template registry + company pillar context + parent + operator's
  // prompt and returns 3-5 ranked candidates.
  recommendAgent: (input: {
    companyId: string;
    parent_slot: string;
    prompt: string;
    available_parents?: Array<{ slot: string; role_hint?: string }>;
  }) =>
    call<{
      ok: true;
      recommendations: Array<{ templateId: string; parent_slot: string; rationale: string; score: number }>;
    }>("POST", "/op-omega/onboarding/recommend-agent", input),

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

  // Help chat (per-company conversational sidebar)
  getHelpChat: (companyId: string) =>
    call<{
      ok: true;
      messages: Array<{ role: "user" | "assistant"; ts_iso: string; text: string; phase?: string; field?: string }>;
    }>("GET", `/api/instance/${encodeURIComponent(companyId)}/help-chat`),

  postHelpChat: (companyId: string, body: { message: string; phase?: string; field?: string }) =>
    call<{
      ok: true;
      messages: Array<{ role: "user" | "assistant"; ts_iso: string; text: string; phase?: string; field?: string }>;
      latest_assistant: { role: "assistant"; ts_iso: string; text: string; phase?: string; field?: string };
    }>("POST", `/api/instance/${encodeURIComponent(companyId)}/help-chat`, body),

  // Redundancy review (exact templateId duplicate groups)
  getRedundancy: (companyId: string) =>
    call<{
      ok: true;
      groups: Array<{
        template_id: string;
        slots: Array<{ slot: string; parent_slot: string; template_id: string; origin: string; muted: boolean }>;
        by_parent: Record<string, number>;
        weight: number;
      }>;
      all_slots: Array<{ slot: string; parent_slot: string; template_id: string; origin: string; muted: boolean }>;
      mutes: string[];
    }>("GET", `/api/instance/${encodeURIComponent(companyId)}/redundancy`),

  muteSlot: (companyId: string, slot: string) =>
    call<{ ok: true; mutes: string[]; sha256: string }>(
      "POST", `/api/instance/${encodeURIComponent(companyId)}/mute-slot`, { slot },
    ),

  unmuteSlot: (companyId: string, slot: string) =>
    call<{ ok: true; mutes: string[]; sha256: string }>(
      "DELETE", `/api/instance/${encodeURIComponent(companyId)}/mute-slot`, { slot },
    ),

  // Token budget (project-level cap, opt-in)
  getTokenBudget: (companyId: string) =>
    call<{
      ok: true;
      budget: { cap_tokens: number | null; set_at: string | null };
      used: number;
    }>("GET", `/api/instance/${encodeURIComponent(companyId)}/token-budget`),

  setTokenBudget: (companyId: string, cap_tokens: number | null) =>
    call<{
      ok: true;
      budget: { cap_tokens: number | null; set_at: string | null };
    }>("POST", `/api/instance/${encodeURIComponent(companyId)}/token-budget`, { cap_tokens }),

  // Token usage (T2 cost tracking, per-company aggregate)
  tokenUsage: (companyId: string) =>
    call<{
      ok: true;
      usage: {
        companyId: string;
        started_at: string;
        updated_at: string;
        total: { input_tokens: number; output_tokens: number; cached_input_tokens: number; cost_usd: number; duration_ms: number; calls: number };
        by_phase: Record<string, { input_tokens: number; output_tokens: number; cached_input_tokens: number; cost_usd: number; duration_ms: number; calls: number; last_call_at?: string }>;
        recent_calls: Array<{ phase: string; ts_iso: string; input_tokens: number; output_tokens: number; cached_input_tokens: number; cost_usd: number; duration_ms: number }>;
      };
    }>("GET", `/api/instance/${encodeURIComponent(companyId)}/token-usage`),

  // Pricing tiers (System Optimizer subscription screen)
  listTiers: () =>
    call<{
      ok: true;
      tiers: Array<{
        id: "trial" | "founder" | "growth" | "custom";
        displayName: string;
        priceLabel: string;
        priceCents: number;
        features: string[];
        recommended: boolean;
        ctaLabel: string;
      }>;
    }>("GET", "/api/tiers"),

  subscribeTier: (input: {
    orgId: string;
    tierId: "trial" | "founder" | "growth" | "custom";
    origin: "subscribe" | "skip";
  }) =>
    call<{ ok: true; orgId: string; tierId: string; origin: string }>(
      "POST", "/api/tier-subscriptions", input,
    ),
};
