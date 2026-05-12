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

export type ChatSlot =
  | { kind: "thinking"; phase: "pillar-1" | "phase-2" | "phase-3" | "phase-4" | "finalize" }
  | { kind: "pillar1-confirm"; response: Pillar1Response }
  | { kind: "pillar1-halt"; operatorMessage: string }
  | { kind: "scope-prompt"; detected: string[] }
  | { kind: "pillar3-prompt" }
  | { kind: "pillar4-prompt" }
  | { kind: "pillar5-prompt" }
  | { kind: "connector-picker"; manifest: ConnectorManifest }
  | { kind: "verify-fail"; fixHint: string };

// ── Top-level phase machine ───────────────────────────────────────────────

export interface ActivateSlotProgress {
  slot: string;
  status: "pending" | "hired" | "failed";
  error?: string;
}

export type OnboardingPhase =
  | { kind: "welcome" }
  | { kind: "pillars"; stage: 1 | 2 | 3 | 4 | 5; thinking: boolean }
  | { kind: "connectors"; manifest?: ConnectorManifest; loading: boolean }
  | { kind: "credentials"; drawerOpen: boolean }
  | { kind: "swarm_transition"; startedAt: number }
  | { kind: "swarm_studio"; manifest: SwarmManifest }
  | { kind: "imprint_theater"; act: 1 | 2 | 3; finalize?: { manifest: CompanyManifest; sha256: string; source: "t2" | "fallback" }; workflowReady: boolean }
  | { kind: "pricing" }
  | { kind: "activate"; progress: ActivateSlotProgress[]; paperclipUrl: string | null }
  | { kind: "handed_off"; paperclipUrl: string | null };

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
  };
}

// ── Actions ───────────────────────────────────────────────────────────────

export type Action =
  | { type: "ADD_MESSAGE"; message: Omit<ChatMessage, "id" | "ts"> & Partial<Pick<ChatMessage, "id" | "ts">> }
  | { type: "REPLACE_MESSAGE"; id: string; patch: Partial<ChatMessage> }
  | { type: "COLLAPSE_MESSAGE"; id: string }
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
  | { type: "HANDED_OFF"; paperclipUrl: string | null };

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
  // swarm-studio and theater require manifest data we don't have at URL parse;
  // return welcome and let hydration figure it out.
  return { kind: "welcome" };
}

/** Phase completion percentage for the top progress bar (0-100). */
export function phaseProgressPct(phase: OnboardingPhase): number {
  switch (phase.kind) {
    case "welcome": return 0;
    case "pillars": return 5 + (phase.stage - 1) * 8; // 5, 13, 21, 29, 37
    case "connectors": return 45;
    case "credentials": return 55;
    case "swarm_transition": return 60;
    case "swarm_studio": return 70;
    case "imprint_theater": return 80 + (phase.act - 1) * 4;
    case "pricing": return 92;
    case "activate": return 96;
    case "handed_off": return 100;
  }
}
