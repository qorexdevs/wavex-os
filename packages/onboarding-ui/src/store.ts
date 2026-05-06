// Simple Zustand store for onboarding state.
// Persists to localStorage so refresh doesn't lose progress.
// In Phase C, this becomes a thin client wrapping the hosted backend's state machine.

import { create } from "zustand";
import { persist } from "zustand/middleware";

export type ConnectorState = {
  status: "not-connected" | "connected" | "error";
  detail?: string;
};

export type AgentSlot = {
  slot: string;            // "ceo", "cmo", "engineer-1", etc.
  templateId?: string;     // from agent-templates registry
  name?: string;
  reportsToSlot?: string;
  ownedKpiIds: string[];
  customizations?: Record<string, unknown>;
};

export type Kpi = {
  id: string;
  label: string;
  direction: "increase" | "decrease" | "maintain";
  currentValue?: number;
  targetValue?: number;
  windowDays?: number;
  ownerSlot?: string;
};

export type OnboardingState = {
  sessionId: string | null;
  companyName: string;
  industry: string;
  goalKpiId: string;
  goalCurrent: number;
  goalTarget: number;
  goalWindowDays: number;
  supportingKpis: Kpi[];
  connectors: Record<string, ConnectorState>;
  agents: AgentSlot[];
  customizationTokensUsed: number;
  customizationTokensCap: number;

  // actions
  setCompanyName: (name: string) => void;
  setIndustry: (industry: string) => void;
  setGoal: (kpiId: string, current: number, target: number, days: number) => void;
  addKpi: (kpi: Kpi) => void;
  setConnectorStatus: (id: string, status: ConnectorState) => void;
  upsertAgent: (agent: AgentSlot) => void;
  removeAgent: (slot: string) => void;
  reset: () => void;
};

const INITIAL: Omit<OnboardingState, "setCompanyName" | "setIndustry" | "setGoal" | "addKpi" | "setConnectorStatus" | "upsertAgent" | "removeAgent" | "reset"> = {
  sessionId: null,
  companyName: "",
  industry: "",
  goalKpiId: "",
  goalCurrent: 0,
  goalTarget: 0,
  goalWindowDays: 90,
  supportingKpis: [],
  connectors: {
    "claude-max": { status: "not-connected" },
    telegram: { status: "not-connected" },
    composio: { status: "not-connected" },
    ngrok: { status: "not-connected" },
    stripe: { status: "not-connected" },
    supabase: { status: "not-connected" },
    github: { status: "not-connected" },
  },
  agents: [],
  customizationTokensUsed: 0,
  customizationTokensCap: 30000,
};

export const useOnboarding = create<OnboardingState>()(
  persist(
    (set) => ({
      ...INITIAL,
      setCompanyName: (companyName) =>
        set((s) => ({
          companyName,
          // Seed a sessionId on first input so Mission Control knows onboarding was touched.
          sessionId: s.sessionId ?? `s_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
        })),
      setIndustry: (industry) => set({ industry }),
      setGoal: (goalKpiId, goalCurrent, goalTarget, goalWindowDays) =>
        set({ goalKpiId, goalCurrent, goalTarget, goalWindowDays }),
      addKpi: (kpi) => set((s) => ({ supportingKpis: [...s.supportingKpis, kpi] })),
      setConnectorStatus: (id, status) =>
        set((s) => ({ connectors: { ...s.connectors, [id]: status } })),
      upsertAgent: (agent) =>
        set((s) => {
          const idx = s.agents.findIndex((a) => a.slot === agent.slot);
          if (idx >= 0) {
            const next = [...s.agents];
            next[idx] = agent;
            return { agents: next };
          }
          return { agents: [...s.agents, agent] };
        }),
      removeAgent: (slot) => set((s) => ({ agents: s.agents.filter((a) => a.slot !== slot) })),
      reset: () => set(INITIAL),
    }),
    { name: "wavex-os-onboarding" },
  ),
);
