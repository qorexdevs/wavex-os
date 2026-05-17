/** Wavex-os onboarding host shell. Single-SPA pattern (no react-router
 *  subroutes) — the Phase state machine drives subview switches. Hydrates
 *  from /wavex-os/onboarding/status on mount. */

import { useState, useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { wavexOsOnboardingApi, ApiError } from "./lib/api";
import { useCompany } from "./lib/CompanyContext";
import { getSupabase } from "../lib/supabase";
import { WelcomeScreen } from "./components/WelcomeScreen";
import { ConfirmResetModal } from "./components/ConfirmResetModal";
import { TokenCounter } from "./components/TokenCounter";
import { BudgetChip } from "./components/BudgetChip";
import { HelpChat } from "./components/HelpChat";
import { preserveDevFlags } from "./lib/dev-flags";
import { Pillar1 } from "./pillars/Pillar1";
import { Pillar2 } from "./pillars/Pillar2";
import { Pillar3 } from "./pillars/Pillar3";
import { Pillar4 } from "./pillars/Pillar4";
import { Pillar5 } from "./pillars/Pillar5";
import { Phase2Connectors } from "./phases/Phase2Connectors";
import { CredentialConcierge } from "./phases/CredentialConcierge";
import { Phase3Swarm } from "./phases/Phase3Swarm";
import { Phase4Workflows } from "./phases/Phase4Workflows";
import { Materialize } from "./phases/Materialize";
import { Pricing } from "./pricing/Pricing";

function fireWizardEvent(userId: string, payload: Record<string, unknown>): void {
  fetch("/api/wizard-events", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId, ...payload, ts: new Date().toISOString() }),
  }).catch(() => {});
}

/** Map paperclip API URL → UI URL (dev convention: 3100 → 5174).
 *  Mirrors the helper inside Materialize.tsx; duplicated here so the
 *  pricing → mission-control transition can open the Paperclip tab. */
function paperclipUiUrl(apiUrl: string | null): string {
  if (!apiUrl) return "#";
  return apiUrl.replace(/:3100\b/, ":5174");
}

type Phase =
  | "welcome"
  | "pillar-1" | "pillar-2" | "pillar-3" | "pillar-4" | "pillar-5"
  | "phase-2-connectors" | "credential-concierge"
  | "phase-3-swarm" | "phase-4-workflows"
  | "materialize" | "pricing";

export function WavexOsOnboarding() {
  const { companyId } = useCompany();
  const qc = useQueryClient();

  if (!companyId) return <WelcomeScreen />;

  return <CompanyWizard companyId={companyId} qc={qc} />;
}

const VALID_PHASES: Phase[] = [
  "welcome",
  "pillar-1", "pillar-2", "pillar-3", "pillar-4", "pillar-5",
  "phase-2-connectors", "credential-concierge",
  "phase-3-swarm", "phase-4-workflows",
  "materialize", "pricing",
];

function CompanyWizard({ companyId, qc }: { companyId: string; qc: ReturnType<typeof useQueryClient> }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const status = useQuery({
    queryKey: ["status", companyId],
    queryFn: () => wavexOsOnboardingApi.status(companyId),
  });

  // Initialize phase from ?phase= URL param if valid, so refresh/share preserves
  // wizard position. Falls back to "pillar-1"; auto-route effect below will then
  // shift to next_pillar (or phase-2-connectors if all done) on first status load.
  const urlPhase = searchParams.get("phase");
  const initialPhase: Phase = (urlPhase && (VALID_PHASES as string[]).includes(urlPhase))
    ? (urlPhase as Phase)
    : "pillar-1";
  const [phase, setPhase] = useState<Phase>(initialPhase);
  const navigate = useNavigate();
  // Holds the Paperclip API URL captured from activate response.
  // Materialize calls onActivated with this; Pricing's onContinue uses it
  // to open the Paperclip tab after the operator picks/skips a plan.
  const [pendingPaperclipUrl, setPendingPaperclipUrl] = useState<string | null>(null);
  // If phase came from URL, treat it as authoritative — don't auto-route over it.
  const [autoRouted, setAutoRouted] = useState(initialPhase !== "pillar-1");

  // Supabase userId for wizard telemetry — resolved once on mount, best-effort.
  const [userId, setUserId] = useState<string | null>(null);
  useEffect(() => {
    getSupabase()?.auth.getSession().then(({ data }) => {
      if (data.session?.user.id) setUserId(data.session.user.id);
    }).catch(() => {});
  }, []);

  // Track whether wizard_complete has been fired to guard abandon logic.
  const completedRef = useRef(false);
  // Track current phase in a ref for the unmount cleanup.
  const phaseRef = useRef<Phase>(phase);
  useEffect(() => { phaseRef.current = phase; }, [phase]);

  // wizard_start on mount (fire-and-forget, once per mount).
  useEffect(() => {
    if (!userId) return;
    fireWizardEvent(userId, { eventType: "wizard_start" });
    completedRef.current = false;
    return () => {
      // wizard_abandon on unmount if wizard_complete was never fired.
      if (!completedRef.current) {
        const STEP_MAP: Partial<Record<Phase, number>> = {
          "pillar-1": 0, "pillar-2": 0, "pillar-3": 0, "pillar-4": 0, "pillar-5": 0,
          "phase-2-connectors": 1, "credential-concierge": 1,
          "phase-3-swarm": 2, "phase-4-workflows": 2,
          "materialize": 3, "pricing": 3,
        };
        fireWizardEvent(userId, {
          eventType: "wizard_abandon",
          lastStep: STEP_MAP[phaseRef.current] ?? 0,
        });
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  // Mirror phase to URL so refresh/back/forward preserve position. Skip when
  // already in sync to avoid redundant history entries.
  useEffect(() => {
    if (searchParams.get("phase") === phase) return;
    const next = new URLSearchParams(searchParams);
    next.set("phase", phase);
    setSearchParams(next, { replace: true });
  }, [phase, searchParams, setSearchParams]);

  // Auto-route from server status — only on first load. After that the user's
  // explicit "Continue →" clicks drive phase transitions.
  useEffect(() => {
    if (autoRouted || !status.data) return;
    const np = status.data.next_pillar;
    if (np) setPhase(`pillar-${np}` as Phase);
    else setPhase("phase-2-connectors"); // all pillars done → start phases
    setAutoRouted(true);
  }, [status.data, autoRouted]);

  const advance = (next: Phase) => {
    setPhase(next);
    setAutoRouted(true); // operator click counts as having decided phase
    qc.invalidateQueries({ queryKey: ["status", companyId] });
    if (userId) {
      if (next === "phase-2-connectors") fireWizardEvent(userId, { eventType: "wizard_step_complete", step: 1 });
      if (next === "phase-3-swarm")       fireWizardEvent(userId, { eventType: "wizard_step_complete", step: 2 });
      if (next === "materialize") {
        fireWizardEvent(userId, { eventType: "wizard_step_complete", step: 3 });
        fireWizardEvent(userId, { eventType: "wizard_complete" });
        completedRef.current = true;
      }
    }
  };

  // Header's onJump bypasses advance() (no qc invalidation needed for a jump).
  // Set autoRouted there too so a fast click before status loads isn't overridden
  // by the auto-routing effect when status finally arrives.
  const handleJump = (next: Phase) => {
    setPhase(next);
    setAutoRouted(true);
  };

  if (status.isLoading) {
    return <div style={{ padding: "2rem", color: "var(--text-dim)" }}>Loading state for {companyId}…</div>;
  }
  if (status.isError) {
    return <div style={{ padding: "2rem", color: "var(--warning)" }}>Status fetch failed: {(status.error as Error).message}</div>;
  }

  const pr = status.data?.responses;

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)" }}>
      <Header companyId={companyId} phase={phase} onJump={handleJump} />

      {phase === "pillar-1" && (
        <Pillar1 companyId={companyId} initial={pr?.pillar_1 ?? undefined} onComplete={() => advance("pillar-2")} />
      )}
      {phase === "pillar-2" && (
        <Pillar2
          companyId={companyId}
          initial={pr?.pillar_2 ? {
            claude_plan: pr.pillar_2.claude_plan as "max_20x" | "max_5x" | "api_only" | "other",
            claude_plan_other_note: pr.pillar_2.claude_plan_other_note,
          } : undefined}
          onComplete={() => advance("pillar-3")}
        />
      )}
      {phase === "pillar-3" && (
        <Pillar3 companyId={companyId} initial={pr?.pillar_3 ?? undefined} onComplete={() => advance("pillar-4")} />
      )}
      {phase === "pillar-4" && (
        <Pillar4 companyId={companyId} initial={pr?.pillar_4 ?? undefined} onComplete={() => advance("pillar-5")} />
      )}
      {phase === "pillar-5" && (
        <Pillar5 companyId={companyId} initial={pr?.pillar_5 ?? undefined} onComplete={() => advance("phase-2-connectors")} />
      )}
      {phase === "phase-2-connectors" && (
        <Phase2Connectors companyId={companyId} onComplete={() => advance("credential-concierge")} />
      )}
      {phase === "credential-concierge" && (
        <CredentialConcierge companyId={companyId} onComplete={() => advance("phase-3-swarm")} />
      )}
      {phase === "phase-3-swarm" && (
        <Phase3Swarm companyId={companyId} onComplete={() => advance("phase-4-workflows")} />
      )}
      {phase === "phase-4-workflows" && (
        <Phase4Workflows companyId={companyId} onComplete={() => advance("materialize")} />
      )}
      {phase === "materialize" && (
        <Materialize
          companyId={companyId}
          onActivated={(url) => setPendingPaperclipUrl(url)}
          onAdvance={() => advance("pricing")}
        />
      )}
      {phase === "pricing" && (
        <Pricing
          companyId={companyId}
          onContinue={() => {
            // Operator chose a tier or skipped. Open Paperclip in a new
            // tab (if the handoff produced a URL) then navigate this tab
            // to Mission Control.
            if (pendingPaperclipUrl) {
              window.open(paperclipUiUrl(pendingPaperclipUrl), "_blank", "noopener");
            }
            navigate(`/?companyId=${encodeURIComponent(companyId)}`);
          }}
        />
      )}

      <HelpChat companyId={companyId} phase={phase} />
    </div>
  );
}

function Header({ companyId, phase, onJump }: { companyId: string; phase: Phase; onJump: (p: Phase) => void }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [confirmReset, setConfirmReset] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);

  const STEPS: Array<{ key: Phase; label: string }> = [
    { key: "pillar-1", label: "Identity" },
    { key: "pillar-2", label: "Inference" },
    { key: "pillar-3", label: "Stage" },
    { key: "pillar-4", label: "GTM" },
    { key: "pillar-5", label: "Comms" },
    { key: "phase-2-connectors", label: "Connectors" },
    { key: "credential-concierge", label: "Credentials" },
    { key: "phase-3-swarm", label: "Swarm" },
    { key: "phase-4-workflows", label: "Workflows" },
    { key: "materialize", label: "Finalize" },
    { key: "pricing", label: "Plan" },
  ];
  const idx = STEPS.findIndex((s) => s.key === phase);

  async function doReset(restart: boolean): Promise<void> {
    setResetting(true);
    setResetError(null);
    try {
      await wavexOsOnboardingApi.resetCompany(companyId);
      await qc.invalidateQueries({ queryKey: ["companies"] });
      await qc.invalidateQueries({ queryKey: ["status", companyId] });
      setConfirmReset(false);
      if (restart) {
        // Reload at same companyId — wizard will hydrate empty Pillar 1.
        navigate(`/onboarding?${preserveDevFlags(`companyId=${encodeURIComponent(companyId)}`)}`);
        // Status query was invalidated; force a refetch by reloading.
        // (CompanyWizard's autoRouted gate would otherwise stick on the old phase.)
        setTimeout(() => window.location.reload(), 100);
      } else {
        navigate(`/onboarding?${preserveDevFlags("")}`);
      }
    } catch (e) {
      setResetError(e instanceof ApiError ? e.message : (e as Error).message);
    } finally {
      setResetting(false);
    }
  }

  return (
    <>
      <header style={{
        position: "sticky", top: 0, zIndex: 10,
        background: "var(--surface)", borderBottom: "1px solid var(--border)",
        padding: "0.75rem 2rem",
        display: "flex", alignItems: "center", justifyContent: "space-between", gap: "1rem",
      }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: "0.75rem" }}>
          <span style={{ fontWeight: 700, fontSize: 14 }}>WaveX OS</span>
          <span className="text-dim" style={{ fontSize: 12 }}>· Onboarding · <code>{companyId}</code></span>
          <button
            type="button"
            onClick={() => { setConfirmReset(true); setResetError(null); }}
            title="Wipe all state for this company and start over"
            style={{
              fontSize: 11, padding: "0.15rem 0.5rem", borderRadius: 4,
              background: "transparent",
              color: "var(--warning)",
              border: "1px solid var(--warning)",
              cursor: "pointer",
              marginLeft: "0.25rem",
            }}
          >
            ↺ Reset
          </button>
          <TokenCounter companyId={companyId} />
          <BudgetChip companyId={companyId} />
        </div>
        <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
          {STEPS.map((s, i) => (
            <button
              type="button"
              key={s.key}
              onClick={() => onJump(s.key)}
              style={{
                fontSize: 11, padding: "0.2rem 0.5rem", borderRadius: 4,
                border: "1px solid var(--border)",
                background: i === idx ? "var(--accent)" : i < idx ? "var(--surface-2)" : "transparent",
                color: i === idx ? "var(--bg)" : i < idx ? "var(--text)" : "var(--text-dim)",
                fontWeight: i === idx ? 700 : 400,
                cursor: "pointer",
              }}
            >
              {s.label}
            </button>
          ))}
        </div>
      </header>

      {resetError && (
        <div style={{
          background: "var(--surface)", borderBottom: "1px solid var(--warning)",
          color: "var(--warning)", padding: "0.5rem 2rem", fontSize: 13,
        }}>
          ✗ Reset failed: {resetError}
        </div>
      )}

      {confirmReset && (
        <ConfirmResetModal
          companyId={companyId}
          busy={resetting}
          onCancel={() => setConfirmReset(false)}
          onConfirm={(restart) => void doReset(restart)}
        />
      )}
    </>
  );
}
