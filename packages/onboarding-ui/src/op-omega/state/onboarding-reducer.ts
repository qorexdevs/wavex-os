/** State reducer for the chat-first onboarding shell.
 *
 *  The shell renders one of nine top-level phases. Each phase carries enough
 *  data to drive its UI without re-fetching from the server (the underlying
 *  manifests are also persisted to disk and can be re-loaded on mount). */

import type {
  ConnectorManifest, SwarmManifest, WorkflowManifest, CompanyManifest,
  Pillar1Response, Pillar3Response, Pillar4Response, Pillar5Response,
} from "@op-omega/plugin-onboarding";

// ── Chat message thread ───────────────────────────────────────────────────

export type ChatRole = "user" | "assistant" | "system";

/** Each message can either be plain text, or carry a tag that the render
 *  layer maps to an inline React component (e.g., "pillar1-confirm" → the
 *  Pillar1ConfirmCard). The shell decides how to render based on the tag. */
export interface ChatMessage {
  id: string;
  role: ChatRole;
  text?: string;
  /** When set, the renderer mounts the component bound to this slot rather
   *  than (or alongside) the text. */
  slot?: ChatSlot;
  ts: number;
  /** Compact form — when true, the renderer collapses to a one-line summary. */
  collapsed?: boolean;
}

export type AccountType = "avatar" | "solo_founder" | "hybrid";

/** First-class Avatar phases — the Avatar branch is a parallel flow to the
 *  company-onboarding pillars, mounted by the same shell so it inherits the
 *  chat-card visuals + scrolling behavior. Solo Founder / Hybrid continue
 *  to use the existing pillar phases; only the entry gateway is shared. */
export interface AvatarProfile {
  name: string;
  role: string;
  workingHours: [string, string]; // ["09:00", "17:00"]
  tz: string;                     // IANA timezone, e.g. "America/New_York"
}

export interface AvatarToolConnection {
  provider: string;               // "gmail" | "slack" | ...
  ref: string;                    // credential vault reference id
  status: "stub" | "connected";   // "stub" until v2 wires real OAuth
}

export interface AvatarVoiceProfile {
  tone: string;
  formality: string;
  structure: string;
  delegates: string[];
}

export interface AvatarAutomationSuggestion {
  id: string;
  title: string;
  body: string;
  needs: string[];                // providers required
}

export type AvatarAutonomyPreset = "cautious" | "balanced" | "aggressive";

export interface AvatarTrust {
  autonomy_preset: AvatarAutonomyPreset;
  vips: Array<{ email: string; label?: string }>;
  privacy_zones: string[];
  notify: string[];               // "now_drafts" | "low_confidence" | "skill_paused" | "daily_digest"
}

export type ChatSlot =
  | { kind: "thinking"; phase: "pillar-1" | "phase-2" | "phase-3" | "phase-4" | "finalize" | "avatar-voice" }
  | { kind: "pillar1-confirm"; response: Pillar1Response }
  | { kind: "pillar1-halt"; operatorMessage: string }
  | { kind: "scope-prompt"; detected: string[] }
  | { kind: "pillar3-prompt" }
  | { kind: "pillar4-prompt" }
  | { kind: "pillar5-prompt" }
  | { kind: "connector-picker"; manifest: ConnectorManifest }
  | { kind: "verify-fail"; fixHint: string }
  | { kind: "transition-pill"; label: string }
  | { kind: "account-type-select" }
  | { kind: "avatar-profile" }
  | { kind: "avatar-tools"; connected: AvatarToolConnection[] }
  | { kind: "avatar-voice"; samples: string[] }
  | { kind: "avatar-suggestions"; suggestions: AvatarAutomationSuggestion[] };

// ── Top-level phase machine ───────────────────────────────────────────────

export interface ActivateSlotProgress {
  slot: string;
  status: "pending" | "hired" | "failed";
  error?: string;
}

export type OnboardingPhase =
  | { kind: "welcome" }
  // Gateway shown to fresh visitors before any onboarding state exists.
  // Resuming operators (?companyId= or ?avatarId= in URL) bypass this.
  | { kind: "account_type_select" }
  | { kind: "pillars"; stage: 1 | 2 | 3 | 4 | 5; thinking: boolean }
  | { kind: "connectors"; manifest?: ConnectorManifest; loading: boolean }
  | { kind: "credentials"; drawerOpen: boolean }
  | { kind: "swarm_transition"; startedAt: number }
  | { kind: "swarm_studio"; manifest: SwarmManifest }
  | { kind: "imprint_theater"; act: 1 | 2 | 3; finalize?: { manifest: CompanyManifest; sha256: string; source: "t2" | "fallback" }; workflowReady: boolean }
  | { kind: "pricing" }
  | { kind: "activate"; progress: ActivateSlotProgress[]; paperclipUrl: string | null }
  | { kind: "handed_off"; paperclipUrl: string | null }
  // Avatar branch — runs entirely inside the chat shell, doesn't touch
  // pillar / connector / swarm phases. Lands on /avatar/:id when finalized.
  | { kind: "avatar_profile" }
  | { kind: "avatar_tools"; connected: AvatarToolConnection[] }
  | { kind: "avatar_voice"; samples: string[]; analyzing: boolean }
  | { kind: "avatar_trust" }
  | { kind: "avatar_suggestions"; suggestions: AvatarAutomationSuggestion[]; enabled: string[] }
  | { kind: "avatar_done"; avatarId: string };

export interface OnboardingState {
  phase: OnboardingPhase;
  thread: ChatMessage[];
  /** Captured during onboarding for resumability + Pillar 1 confirm card. */
  draft: {
    pillar1?: { rawInput: string };
    pillar1Response?: Pillar1Response;
    pillar3Response?: Pillar3Response;
    pillar4Response?: Pillar4Response;
    pillar5Response?: Pillar5Response;
    swarmManifest?: SwarmManifest;
    workflowManifest?: WorkflowManifest;
    connectorManifest?: ConnectorManifest;
    /** Account type chosen at the gateway. Drives whether the operator
     *  enters the Avatar branch or the existing pillar flow, and (for
     *  Hybrid / Solo Founder) the default scope mode the pillar flow
     *  seeds when it eventually reaches the scope picker. */
    accountType?: AccountType;
    avatarId?: string;
    avatarProfile?: AvatarProfile;
    avatarTools?: AvatarToolConnection[];
    avatarVoice?: { samples: string[]; profile?: AvatarVoiceProfile };
    avatarTrust?: AvatarTrust;
    avatarSuggestions?: AvatarAutomationSuggestion[];
    avatarEnabledAutomations?: string[];
  };
}

// ── Actions ───────────────────────────────────────────────────────────────

export type Action =
  | { type: "ADD_MESSAGE"; message: Omit<ChatMessage, "id" | "ts"> & Partial<Pick<ChatMessage, "id" | "ts">> }
  | { type: "REPLACE_MESSAGE"; id: string; patch: Partial<ChatMessage> }
  | { type: "COLLAPSE_MESSAGE"; id: string }
  | { type: "UNCOLLAPSE_MESSAGE"; id: string }
  | { type: "COLLAPSE_LAST_SLOT"; kind: ChatSlot["kind"] }
  | { type: "SET_PHASE"; phase: OnboardingPhase }
  | { type: "SET_DRAFT"; draft: Partial<OnboardingState["draft"]> }
  | { type: "WELCOME_SUBMIT"; rawInput: string }
  | { type: "PILLAR1_RESPONSE"; response: Pillar1Response }
  | { type: "PILLAR1_HALT"; operatorMessage: string }
  | { type: "PILLAR1_CONFIRMED" }
  | { type: "VERIFY_FAILED"; fixHint: string }
  | { type: "PILLAR3_DONE"; response: Pillar3Response }
  | { type: "PILLAR4_DONE"; response: Pillar4Response }
  | { type: "PILLAR5_DONE"; response: Pillar5Response }
  | { type: "CONNECTORS_LOADED"; manifest: ConnectorManifest }
  | { type: "CONNECTORS_CONFIRMED" }
  | { type: "CREDENTIALS_DONE" }
  | { type: "SWARM_LOADED"; manifest: SwarmManifest }
  | { type: "SWARM_CONFIRMED"; manifest: SwarmManifest }
  | { type: "FINALIZE_RESULT"; manifest: CompanyManifest; sha256: string; source: "t2" | "fallback" }
  | { type: "WORKFLOW_PREFETCH_DONE" }
  | { type: "ADVANCE_THEATER_ACT"; act: 1 | 2 | 3 }
  | { type: "OPEN_PRICING" }
  | { type: "PRICING_DONE" }
  | { type: "ACTIVATE_PROGRESS"; progress: ActivateSlotProgress[]; paperclipUrl?: string | null }
  | { type: "HANDED_OFF"; paperclipUrl: string | null }
  // Avatar branch actions
  | { type: "ACCOUNT_TYPE_SELECTED"; accountType: AccountType }
  | { type: "AVATAR_PROFILE_DONE"; profile: AvatarProfile; avatarId: string }
  | { type: "AVATAR_TOOL_CONNECTED"; connection: AvatarToolConnection }
  | { type: "AVATAR_TOOLS_DONE" }
  | { type: "AVATAR_VOICE_SAMPLE"; index: 0 | 1 | 2; text: string }
  | { type: "AVATAR_VOICE_ANALYZING" }
  | { type: "AVATAR_VOICE_DONE"; profile: AvatarVoiceProfile }
  | { type: "AVATAR_TRUST_DONE"; trust: AvatarTrust }
  | { type: "AVATAR_SUGGESTIONS_LOADED"; suggestions: AvatarAutomationSuggestion[] }
  | { type: "AVATAR_AUTOMATION_TOGGLED"; suggestionId: string }
  | { type: "AVATAR_FINALIZED"; avatarId: string };

let msgCounter = 0;
function newId(): string {
  msgCounter += 1;
  return `m-${Date.now().toString(36)}-${msgCounter}`;
}

export const initialState: OnboardingState = {
  phase: { kind: "welcome" },
  thread: [],
  draft: {},
};

export function reducer(state: OnboardingState, action: Action): OnboardingState {
  switch (action.type) {
    case "ADD_MESSAGE": {
      const m: ChatMessage = {
        id: action.message.id ?? newId(),
        ts: action.message.ts ?? Date.now(),
        role: action.message.role,
        text: action.message.text,
        slot: action.message.slot,
        collapsed: action.message.collapsed,
      };
      return { ...state, thread: [...state.thread, m] };
    }

    case "REPLACE_MESSAGE":
      return {
        ...state,
        thread: state.thread.map((m) => (m.id === action.id ? { ...m, ...action.patch } : m)),
      };

    case "COLLAPSE_MESSAGE":
      return {
        ...state,
        thread: state.thread.map((m) => (m.id === action.id ? { ...m, collapsed: true } : m)),
      };

    case "UNCOLLAPSE_MESSAGE":
      return {
        ...state,
        thread: state.thread.map((m) => (m.id === action.id ? { ...m, collapsed: false } : m)),
      };

    case "COLLAPSE_LAST_SLOT": {
      // Walk back to find the last message carrying this slot kind and
      // mark only that one collapsed. Lets handlers say "the card I just
      // resolved" without threading message ids through props.
      let collapsedIdx = -1;
      for (let i = state.thread.length - 1; i >= 0; i--) {
        if (state.thread[i].slot?.kind === action.kind && !state.thread[i].collapsed) {
          collapsedIdx = i;
          break;
        }
      }
      if (collapsedIdx === -1) return state;
      return {
        ...state,
        thread: state.thread.map((m, i) => (i === collapsedIdx ? { ...m, collapsed: true } : m)),
      };
    }

    case "SET_PHASE":
      return { ...state, phase: action.phase };

    case "SET_DRAFT":
      return { ...state, draft: { ...state.draft, ...action.draft } };

    case "WELCOME_SUBMIT":
      return {
        ...state,
        phase: { kind: "pillars", stage: 1, thinking: true },
        draft: { ...state.draft, pillar1: { rawInput: action.rawInput } },
      };

    case "PILLAR1_RESPONSE":
      return {
        ...state,
        phase: { kind: "pillars", stage: 1, thinking: false },
        draft: { ...state.draft, pillar1Response: action.response },
      };

    case "PILLAR1_HALT":
      return {
        ...state,
        phase: { kind: "pillars", stage: 1, thinking: false },
      };

    case "PILLAR1_CONFIRMED":
      return {
        ...state,
        phase: { kind: "pillars", stage: 2, thinking: true },
      };

    case "VERIFY_FAILED":
      return {
        ...state,
        phase: { kind: "pillars", stage: 2, thinking: false },
      };

    case "PILLAR3_DONE":
      return {
        ...state,
        phase: { kind: "pillars", stage: 4, thinking: false },
        draft: { ...state.draft, pillar3Response: action.response },
      };

    case "PILLAR4_DONE":
      return {
        ...state,
        phase: { kind: "pillars", stage: 5, thinking: false },
        draft: { ...state.draft, pillar4Response: action.response },
      };

    case "PILLAR5_DONE":
      return {
        ...state,
        phase: { kind: "connectors", loading: true },
        draft: { ...state.draft, pillar5Response: action.response },
      };

    case "CONNECTORS_LOADED":
      return {
        ...state,
        phase: { kind: "connectors", loading: false, manifest: action.manifest },
        draft: { ...state.draft, connectorManifest: action.manifest },
      };

    case "CONNECTORS_CONFIRMED":
      return {
        ...state,
        phase: { kind: "credentials", drawerOpen: true },
      };

    case "CREDENTIALS_DONE":
      return {
        ...state,
        phase: { kind: "swarm_transition", startedAt: Date.now() },
      };

    case "SWARM_LOADED":
      return {
        ...state,
        phase: { kind: "swarm_studio", manifest: action.manifest },
        draft: { ...state.draft, swarmManifest: action.manifest },
      };

    case "SWARM_CONFIRMED":
      return {
        ...state,
        phase: { kind: "imprint_theater", act: 1, workflowReady: false },
        draft: { ...state.draft, swarmManifest: action.manifest },
      };

    case "WORKFLOW_PREFETCH_DONE":
      return state.phase.kind === "imprint_theater"
        ? { ...state, phase: { ...state.phase, workflowReady: true } }
        : state;

    case "ADVANCE_THEATER_ACT":
      return state.phase.kind === "imprint_theater"
        ? { ...state, phase: { ...state.phase, act: action.act } }
        : state;

    case "FINALIZE_RESULT":
      return state.phase.kind === "imprint_theater"
        ? {
            ...state,
            phase: {
              ...state.phase,
              finalize: { manifest: action.manifest, sha256: action.sha256, source: action.source },
            },
          }
        : state;

    case "OPEN_PRICING":
      return { ...state, phase: { kind: "pricing" } };

    case "PRICING_DONE":
      return { ...state, phase: { kind: "activate", progress: [], paperclipUrl: null } };

    case "ACTIVATE_PROGRESS":
      return state.phase.kind === "activate"
        ? {
            ...state,
            phase: {
              ...state.phase,
              progress: action.progress,
              paperclipUrl: action.paperclipUrl ?? state.phase.paperclipUrl,
            },
          }
        : state;

    case "HANDED_OFF":
      return { ...state, phase: { kind: "handed_off", paperclipUrl: action.paperclipUrl } };

    case "ACCOUNT_TYPE_SELECTED": {
      // Solo Founder + Hybrid fall back into the existing pillar flow via
      // the welcome textarea, so the gateway just records the choice and
      // restores the welcome phase. Avatar starts the parallel branch.
      const nextDraft = { ...state.draft, accountType: action.accountType };
      if (action.accountType === "avatar") {
        return { ...state, phase: { kind: "avatar_profile" }, draft: nextDraft };
      }
      return { ...state, phase: { kind: "welcome" }, draft: nextDraft };
    }

    case "AVATAR_PROFILE_DONE":
      return {
        ...state,
        phase: { kind: "avatar_tools", connected: [] },
        draft: { ...state.draft, avatarProfile: action.profile, avatarId: action.avatarId },
      };

    case "AVATAR_TOOL_CONNECTED": {
      if (state.phase.kind !== "avatar_tools") return state;
      // Dedupe by provider — re-clicking Connect after success is a no-op.
      const without = state.phase.connected.filter((c) => c.provider !== action.connection.provider);
      const connected = [...without, action.connection];
      return {
        ...state,
        phase: { ...state.phase, connected },
        draft: { ...state.draft, avatarTools: connected },
      };
    }

    case "AVATAR_TOOLS_DONE":
      return { ...state, phase: { kind: "avatar_voice", samples: ["", "", ""], analyzing: false } };

    case "AVATAR_VOICE_SAMPLE": {
      if (state.phase.kind !== "avatar_voice") return state;
      const samples: string[] = [...state.phase.samples];
      samples[action.index] = action.text;
      return { ...state, phase: { ...state.phase, samples } };
    }

    case "AVATAR_VOICE_ANALYZING":
      return state.phase.kind === "avatar_voice"
        ? { ...state, phase: { ...state.phase, analyzing: true } }
        : state;

    case "AVATAR_VOICE_DONE":
      return {
        ...state,
        // Phase 3 — voice now hands off to the new Trust & boundaries step
        // before Suggestions, so the runner has autonomy + VIP signal on
        // its first triage cycle.
        phase: { kind: "avatar_trust" },
        draft: {
          ...state.draft,
          avatarVoice: {
            samples: state.phase.kind === "avatar_voice" ? state.phase.samples : [],
            profile: action.profile,
          },
        },
      };

    case "AVATAR_TRUST_DONE":
      return {
        ...state,
        phase: { kind: "avatar_suggestions", suggestions: [], enabled: [] },
        draft: { ...state.draft, avatarTrust: action.trust },
      };

    case "AVATAR_SUGGESTIONS_LOADED":
      return state.phase.kind === "avatar_suggestions"
        ? { ...state, phase: { ...state.phase, suggestions: action.suggestions },
            draft: { ...state.draft, avatarSuggestions: action.suggestions } }
        : state;

    case "AVATAR_AUTOMATION_TOGGLED": {
      if (state.phase.kind !== "avatar_suggestions") return state;
      const enabled = state.phase.enabled.includes(action.suggestionId)
        ? state.phase.enabled.filter((id) => id !== action.suggestionId)
        : [...state.phase.enabled, action.suggestionId];
      return {
        ...state,
        phase: { ...state.phase, enabled },
        draft: { ...state.draft, avatarEnabledAutomations: enabled },
      };
    }

    case "AVATAR_FINALIZED":
      return { ...state, phase: { kind: "avatar_done", avatarId: action.avatarId } };

    default:
      return state;
  }
}

/** Convert a phase to the `?phase=` query param value used in URL state. */
export function phaseToUrlKey(phase: OnboardingPhase): string {
  switch (phase.kind) {
    case "welcome": return "welcome";
    case "pillars": return `pillar-${phase.stage}`;
    case "connectors": return "connectors";
    case "credentials": return "credentials";
    case "swarm_transition": return "swarm-transition";
    case "swarm_studio": return "swarm-studio";
    case "imprint_theater": return "theater";
    case "pricing": return "pricing";
    case "activate": return "activate";
    case "handed_off": return "handed-off";
    case "account_type_select": return "account-type";
    case "avatar_profile": return "avatar-profile";
    case "avatar_tools": return "avatar-tools";
    case "avatar_voice": return "avatar-voice";
    case "avatar_trust": return "avatar-trust";
    case "avatar_suggestions": return "avatar-suggestions";
    case "avatar_done": return "avatar-done";
  }
}

/** Inverse of phaseToUrlKey for hydration on mount. Returns a minimal phase
 *  shape; hydration code overlays the real data after status is loaded. */
export function urlKeyToPhase(key: string): OnboardingPhase {
  if (key === "welcome") return { kind: "welcome" };
  const m = /^pillar-([1-5])$/.exec(key);
  if (m) return { kind: "pillars", stage: Number(m[1]) as 1 | 2 | 3 | 4 | 5, thinking: false };
  if (key === "connectors") return { kind: "connectors", loading: false };
  if (key === "credentials") return { kind: "credentials", drawerOpen: true };
  if (key === "swarm-transition") return { kind: "swarm_transition", startedAt: Date.now() };
  if (key === "pricing") return { kind: "pricing" };
  if (key === "activate") return { kind: "activate", progress: [], paperclipUrl: null };
  if (key === "handed-off") return { kind: "handed_off", paperclipUrl: null };
  if (key === "account-type") return { kind: "account_type_select" };
  if (key === "avatar-profile") return { kind: "avatar_profile" };
  if (key === "avatar-tools") return { kind: "avatar_tools", connected: [] };
  if (key === "avatar-voice") return { kind: "avatar_voice", samples: ["", "", ""], analyzing: false };
  if (key === "avatar-trust") return { kind: "avatar_trust" };
  if (key === "avatar-suggestions") return { kind: "avatar_suggestions", suggestions: [], enabled: [] };
  // swarm-studio, theater, and avatar-done require backing data we don't have
  // at URL parse; return welcome and let hydration figure it out.
  return { kind: "welcome" };
}

/** Phase completion percentage for the top progress bar (0-100). The Avatar
 *  branch is a separate 4-step sequence with its own progress ramp; both
 *  branches end at 100% once they hand off to their respective dashboard. */
export function phaseProgressPct(phase: OnboardingPhase): number {
  switch (phase.kind) {
    case "welcome": return 0;
    case "account_type_select": return 2;
    case "pillars": return 5 + (phase.stage - 1) * 8; // 5, 13, 21, 29, 37
    case "connectors": return 45;
    case "credentials": return 55;
    case "swarm_transition": return 60;
    case "swarm_studio": return 70;
    case "imprint_theater": return 80 + (phase.act - 1) * 4;
    case "pricing": return 92;
    case "activate": return 96;
    case "handed_off": return 100;
    case "avatar_profile": return 15;
    case "avatar_tools": return 35;
    case "avatar_voice": return 55;
    case "avatar_trust": return 75;
    case "avatar_suggestions": return 92;
    case "avatar_done": return 100;
  }
}
