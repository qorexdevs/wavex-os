/**
 * Operator Ω · onboarding host page.
 *
 * Phases are rendered in-order based on the server's /status response.
 * Per-pillar and per-phase implementations live under
 * `components/op-omega/onboarding/`; this file routes between them.
 */

import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@/lib/router";
import { useCompany } from "../context/CompanyContext";
import { Card } from "../components/ui/card";
import { cn } from "@/lib/utils";
import { Bot, Cable, CheckCircle2, ChevronLeft, FastForward, Gauge, Loader2, Workflow } from "lucide-react";
import { opOmegaOnboardingApi } from "../api/opOmegaOnboarding";
import { ApiError } from "../api/client";
import { SwarmOrgChart } from "../components/op-omega/onboarding/SwarmOrgChart";
import { Phase1Host } from "../components/op-omega/onboarding/phase1-host";
import { GenerateManifestPhase } from "../components/op-omega/onboarding/generate-manifest-phase";
import { ConnectorView } from "../components/op-omega/onboarding/connector-view";
import { CompanyView } from "../components/op-omega/onboarding/company-view";
import { WorkflowPhase } from "../components/op-omega/onboarding/workflow-phase";
import { KPIVerifyPhase } from "../components/op-omega/onboarding/kpi-verify-phase";
import { MaterializePhase } from "../components/op-omega/onboarding/materialize-phase";
import { StepDot } from "../components/op-omega/onboarding/primitives";
import { WelcomeScreen } from "../components/op-omega/onboarding/welcome-screen";
import { Phase2ConnectorStep } from "../components/op-omega/onboarding/Phase2ConnectorStep";
import { CredentialConciergeStep } from "../components/op-omega/onboarding/CredentialConciergeStep";
import { describePhase, formatTimeRemaining } from "../components/op-omega/onboarding/progress-helpers";
import { PHASE_LABELS } from "../i18n/phase-labels";
import { companiesApi } from "../api/companies";
import {
  clearDraftInflight,
  looksLikeDraftCompanyName,
  readDraftInflight,
  writeDraftInflight,
} from "../lib/onboarding-draft";

/**
 * Skip-inference is a developer-only escape hatch. Gated on BOTH a Vite-time
 * DEV build flag AND `?dev=1` in the URL — production bundles never expose
 * it regardless of URL params, so a shared link can't unlock the shortcut on
 * a deployed instance.
 */
function isDevMode(): boolean {
  if (typeof window === "undefined") return false;
  if (!import.meta.env.DEV) return false;
  return new URLSearchParams(window.location.search).get("dev") === "1";
}

type Phase =
  | 1
  | 2
  | 3
  | 4
  | "composio_bootstrap"
  | "connector_pick"
  | "direct_credentials"
  | "connector"
  | "swarm"
  | "workflow"
  | "kpi_verify"
  | "finalize"
  | "materialize"
  | "done";

export function OmegaOnboarding() {
  const navigate = useNavigate();
  const { selectedCompanyId, setSelectedCompanyId, createCompany } = useCompany();
  const qc = useQueryClient();
  const [phase, setPhase] = useState<Phase>(1);
  const [skipInference, setSkipInference] = useState(false);
  const [welcomeDismissed, setWelcomeDismissed] = useState(false);
  const [creatingFresh, setCreatingFresh] = useState(false);

  const handleStartFresh = async () => {
    if (creatingFresh) return;
    setCreatingFresh(true);
    try {
      // Idempotency: if a prior visit already created a draft (this tab, a
      // sibling tab, or a refresh during the fade-out), reuse it instead of
      // creating yet another stub. The flag lives in localStorage so it
      // survives reload and is shared across tabs of the same origin.
      const inflightId = readDraftInflight();
      let target = inflightId
        ? await companiesApi.get(inflightId).catch(() => null)
        : null;
      // Reuse only if the draft still matches the stub-name pattern (i.e.
      // Pillar 1 hasn't renamed it yet) and is still active.
      if (target && (target.status !== "active" || !looksLikeDraftCompanyName(target.name))) {
        target = null;
        clearDraftInflight();
      }
      if (!target) {
        const stamp = new Date().toISOString().slice(0, 16).replace("T", " ");
        target = await createCompany({
          name: `New onboarding · ${stamp}`,
          budgetMonthlyCents: 0,
        });
        writeDraftInflight(target.id);
      }
      setSelectedCompanyId(target.id, { source: "manual" });
      // Drop any cached status from the prior selected company so React Query
      // doesn't briefly hand the old `complete: true` payload to the new
      // queryKey (the source of the "lands on step 6" race).
      qc.removeQueries({ queryKey: ["op-omega", "onboarding-status"] });
      // Friction-fix #6: brief fade-out before hard-reload so the operator
      // sees a deliberate transition instead of a flicker. 200ms feels
      // intentional without dragging.
      document.body.style.transition = "opacity 200ms ease-out";
      document.body.style.opacity = "0";
      setTimeout(() => {
        // Hard reload the route so the component remounts with no stale phase /
        // welcomeDismissed / status state. New selectedCompanyId is in localStorage.
        window.location.assign(window.location.pathname + window.location.search);
      }, 220);
    } catch (err) {
      setCreatingFresh(false);
      // Re-throw so FreshUserBootstrap (or any other caller wanting to know)
      // can present a retry UI. The "Start a new onboarding" button doesn't
      // need this signal — its own bail behavior + the persistent button is
      // enough — but the auto-bootstrap path needs the failure to surface.
      throw err;
    }
  };
  const devMode = isDevMode();
  const [generatedManifests, setGeneratedManifests] = useState<{
    connector?: unknown;
    swarm?: unknown;
    workflow?: unknown;
    company?: unknown;
  }>({});
  // Cache the full GenerateManifestPhase envelope (manifest + source + warnings)
  // per accepted phase, so the back-nav can rehydrate the prior screen
  // without re-running the (slow, T2-driven) generate() call. Reset whenever
  // the operator clicks "Regenerate" on the phase itself.
  type CachedEnvelope<M = unknown> = { manifest: M; source: "t2" | "fallback"; warnings: string[] };
  const [cachedEnvelopes, setCachedEnvelopes] = useState<{
    connector?: CachedEnvelope;
    swarm?: CachedEnvelope;
    finalize?: CachedEnvelope;
  }>({});

  const { data: status, isLoading, isFetching } = useQuery({
    queryKey: ["op-omega", "onboarding-status", selectedCompanyId],
    queryFn: () => opOmegaOnboardingApi.status(selectedCompanyId!),
    enabled: !!selectedCompanyId,
    refetchInterval: phase === 1 ? false : 0,
  });

  // Authoritative "all 14 phases done" signal from the server. Compares the
  // expected active-agent count from company.manifest.json against the
  // actual agents row count. Critical that this is server-side: a partial
  // materialization (12 of 34 agents created, then crash) needs to resume
  // at materialize, not be treated as "done." A naive `agents.length > 0`
  // would falsely report done in that case.
  const fullyMaterialized = status?.materialize_state?.complete === true;

  // Track which company the most-recent `status` payload was fetched for. When
  // the operator switches companies (e.g. via "Start a new onboarding"), the
  // useQuery's `data` can briefly hold the prior company's payload while the
  // new fetch is in flight — without this ref we'd auto-route on stale data.
  const statusCompanyIdRef = useRef<string | null>(null);

  useEffect(() => {
    // If selectedCompanyId just changed, drop any stale auto-routing decision
    // until status is refetched for the new company.
    if (selectedCompanyId !== statusCompanyIdRef.current) {
      statusCompanyIdRef.current = selectedCompanyId;
      setPhase(1);
      return;
    }
    // Once Pillar 1 has been answered for this company it has officially
    // "graduated" out of the draft-stub state — drop the inflight flag so a
    // future /omega-onboarding visit doesn't try to resume here.
    if (status?.responses?.pillar_1 && readDraftInflight() === selectedCompanyId) {
      clearDraftInflight();
    }
    // While a refetch is in flight (e.g. after an invalidate), `data` may hold
    // the previous payload. Don't auto-route off potentially stale data.
    if (isFetching) return;
    if (!status) return;
    if (status.next_pillar === 1) setPhase(1);
    else if (status.next_pillar === 2) setPhase(2);
    else if (status.next_pillar === 3) setPhase(3);
    else if (status.next_pillar === 4) setPhase(4);
    else if (status.next_pillar === 5) {
      // Pillar 5 uses same phase number mapping — we label it as phase 4→5 transition in UI
      setPhase(4);
    } else if (status.complete) {
      // Phase 1 done; route to the credential concierge bootstrap step. From there
      // the operator pastes the Composio API key (or skips it), then proceeds to
      // connector_pick → direct_credentials → connector preview.
      setPhase((current) =>
        current === 1 || current === 2 || current === 3 || current === 4 ? "composio_bootstrap" : current,
      );
    }
  }, [status, selectedCompanyId, isFetching]);

  // Fresh user landed here from Dashboard's empty-state / Layout's auto-redirect
  // and has no company selected yet. Silently spin one up + select it so the
  // welcome screen renders without the operator hitting a dead-end.
  if (!selectedCompanyId) {
    return (
      <FreshUserBootstrap
        creatingFresh={creatingFresh}
        onStart={handleStartFresh}
        reason="no_company"
      />
    );
  }

  if (isLoading) return <div className="p-8 text-sm text-muted-foreground">Loading onboarding state…</div>;

  // Operator landed on /omega-onboarding with a *fully-materialized* company
  // auto-selected (e.g. via localStorage from a prior session). The auto-resume
  // logic would route them to composio_bootstrap (step 6), which is wrong: the
  // company has nothing left to do here. Visiting /omega-onboarding intentionally
  // means "I want to onboard." Trigger a fresh bootstrap so they land on Pillar 1
  // instead of mid-flow for a company that's already finalized + materialized.
  //
  // Critical: gate on `fullyMaterialized`, not just `status.complete`.
  // status.complete only covers Pillars 1-5 — a user mid-phase-6 also has
  // status.complete=true and should *resume* at composio_bootstrap, not
  // fresh-start. agents.length > 0 distinguishes "all 14 phases done" from
  // "pillars done, somewhere in phases 6-14."
  if (status?.complete === true && fullyMaterialized && !welcomeDismissed) {
    return (
      <FreshUserBootstrap
        creatingFresh={creatingFresh}
        onStart={handleStartFresh}
        reason="prior_company_complete"
      />
    );
  }

  const progressCount = status?.responses
    ? [
        status.responses.pillar_1,
        status.responses.pillar_2,
        status.responses.pillar_3,
        status.responses.pillar_4,
        status.responses.pillar_5,
      ].filter(Boolean).length
    : 0;

  // Welcome screen replaces the normal page on first entry only
  // (no pillars answered yet AND operator hasn't clicked through it).
  const showWelcome = phase === 1 && progressCount === 0 && !welcomeDismissed;
  if (showWelcome) {
    return (
      <div
        className="mx-auto max-w-3xl space-y-6 p-4 pb-24 sm:p-6"
        style={{ maxHeight: "calc(100dvh - 4rem)", overflowY: "auto" }}
      >
        <WelcomeScreen onStart={() => setWelcomeDismissed(true)} />
      </div>
    );
  }

  // Single source of truth: derive both the bar width and the step label from
  // describePhase().stepIndex, so they can never disagree.
  const phaseInfo = describePhase(phase, status?.next_pillar ?? null);
  const progressPct = Math.min(100, (phaseInfo.stepIndex / 14) * 100);

  // Back-nav: phases where the operator can step backward without losing
  // server-side state. Excludes finalize/materialize (manifest signed / agents
  // already created) and the pillar phases (Phase1Host has its own pillar tab
  // strip for revisiting). For each phase, define the prior step we'd go to.
  const PHASE_BACK_TARGETS: Partial<Record<typeof phase, typeof phase>> = {
    composio_bootstrap: 1,
    connector_pick: "composio_bootstrap",
    direct_credentials: "connector_pick",
    connector: "direct_credentials",
    swarm: "connector",
    workflow: "swarm",
    kpi_verify: "workflow",
  };
  const backTarget = PHASE_BACK_TARGETS[phase];

  return (
    <div
      className="mx-auto max-w-3xl space-y-6 p-4 pb-24 sm:p-6"
      style={{ maxHeight: "calc(100dvh - 4rem)", overflowY: "auto" }}
    >
      <header className="space-y-2">
        <div className="flex items-center justify-between gap-2 text-xs uppercase tracking-wide text-muted-foreground">
          <div className="flex items-center gap-2">
            <span className="flex size-5 items-center justify-center rounded-full bg-purple-500/20 text-[10px] font-semibold text-purple-700 dark:text-purple-300">
              Ω
            </span>
            <span>Operator Ω · Onboarding Pipeline</span>
          </div>
          {/* Hide on terminal phases — by materialize the operator has already
              committed manifest + agents; offering "start over" makes no sense
              and would orphan a fully-built company. */}
          {phase !== "materialize" && phase !== "done" && (
            <button
              type="button"
              onClick={() => {
                // Confirm before discarding mid-flow progress. progressCount > 0
                // means at least one pillar has been answered; clicking through
                // creates a fresh company and orphans this one.
                if (progressCount > 0) {
                  const ok = window.confirm(
                    `You've answered ${progressCount} of 5 pillar${progressCount === 1 ? "" : "s"}. ` +
                      `Starting a new onboarding will leave this company half-finished. Continue?`,
                  );
                  if (!ok) return;
                }
                void handleStartFresh();
              }}
              disabled={creatingFresh}
              className={cn(
                "rounded-md border border-border/60 px-2 py-1 text-[10px] font-medium normal-case tracking-normal transition",
                "hover:border-foreground/40 hover:bg-accent",
                "disabled:pointer-events-none disabled:opacity-50",
              )}
              title="Create a new company and start onboarding from Pillar 1"
            >
              {creatingFresh ? "Creating…" : "Start a new onboarding"}
            </button>
          )}
        </div>
        <h1 className="text-2xl font-semibold">Configure your revenue flywheel</h1>
        <div className="h-1.5 w-full overflow-hidden rounded bg-muted">
          <div
            className="h-full rounded bg-emerald-500 transition-all"
            style={{ width: `${progressPct}%` }}
          />
        </div>
        <div className="flex items-center justify-between text-[11px]">
          <div className="flex items-center gap-2">
            {backTarget !== undefined && (
              <button
                type="button"
                onClick={() => setPhase(backTarget)}
                className="flex items-center gap-0.5 text-muted-foreground hover:text-foreground transition-colors"
                title="Go back to the previous step"
              >
                <ChevronLeft className="size-3" />
                Back
              </button>
            )}
            <span className="font-medium text-foreground">{phaseInfo.label}</span>
          </div>
          <span className="text-muted-foreground">{formatTimeRemaining(phaseInfo.minutesRemaining)}</span>
        </div>
        <div className="flex gap-1.5 text-[10px] text-muted-foreground">
          <StepDot
            active={phase === 1 || phase === 2 || phase === 3 || phase === 4}
            done={progressCount === 5}
            label={PHASE_LABELS.pillars.step}
          />
          <StepDot
            active={
              phase === "composio_bootstrap" ||
              phase === "connector_pick" ||
              phase === "direct_credentials" ||
              phase === "connector"
            }
            done={!!generatedManifests.connector}
            label={PHASE_LABELS.connector.step}
          />
          <StepDot
            active={phase === "swarm"}
            done={!!generatedManifests.swarm}
            label={PHASE_LABELS.swarm.step}
          />
          <StepDot
            active={phase === "workflow"}
            done={!!generatedManifests.workflow}
            label={PHASE_LABELS.workflow.step}
          />
          <StepDot
            active={phase === "finalize" || phase === "materialize"}
            done={!!generatedManifests.company}
            label={PHASE_LABELS.finalize.step}
          />
        </div>
        {devMode && (
          <label
            className={cn(
              "flex w-fit cursor-pointer items-center gap-2 rounded-md border px-2 py-1 text-[11px] transition",
              skipInference
                ? "border-amber-500/40 bg-amber-500/5 text-amber-700 dark:text-amber-400"
                : "hover:bg-accent",
            )}
          >
            <input
              type="checkbox"
              checked={skipInference}
              onChange={(e) => setSkipInference(e.target.checked)}
              className="size-3"
            />
            <FastForward className="size-3" />
            <span>Dev: skip T2 inference (deterministic baseline only; phases finish instantly)</span>
          </label>
        )}
      </header>

      {/* Phase 1 · Pillars */}
      {(phase === 1 || phase === 2 || phase === 3 || phase === 4) && status && (
        <Phase1Host
          companyId={selectedCompanyId}
          status={status}
          onComplete={() => {
            qc.invalidateQueries({ queryKey: ["op-omega", "onboarding-status", selectedCompanyId] });
            setPhase("connector_pick");
          }}
        />
      )}

      {/* Phase 2 · Composio bootstrap (Credential Concierge) */}
      {phase === "composio_bootstrap" && (
        <CredentialConciergeStep
          companyId={selectedCompanyId}
          mode="bootstrap"
          onComplete={() => setPhase("connector_pick")}
        />
      )}

      {/* Phase 2A · Connector pick — interactive plug-and-confirm (Composio integration · §5D) */}
      {phase === "connector_pick" && (
        <Phase2ConnectorStep
          companyId={selectedCompanyId}
          onComplete={() => setPhase("direct_credentials")}
          onSessionExpired={() => {
            // Composio rejected the bootstrap-time API key (revoked / rotated /
            // expired). Drop them back to the bootstrap step so they can paste
            // a fresh one. The credentialsState query auto-refetches there.
            qc.invalidateQueries({ queryKey: ["op-omega", "credentials", selectedCompanyId] });
            setPhase("composio_bootstrap");
          }}
        />
      )}

      {/* Phase 2B · Direct credentials (Credential Concierge) */}
      {phase === "direct_credentials" && (
        <CredentialConciergeStep
          companyId={selectedCompanyId}
          mode="direct"
          onComplete={() => setPhase("connector")}
        />
      )}

      {/* Phase 2B · Connector manifest preview (now reflects any plugged connections) */}
      {phase === "connector" && (
        <GenerateManifestPhase
          title={PHASE_LABELS.connector.title}
          description={PHASE_LABELS.connector.description}
          icon={Cable}
          skipInference={skipInference}
          cached={cachedEnvelopes.connector as never}
          generate={() => opOmegaOnboardingApi.generateConnector(selectedCompanyId, skipInference)}
          renderManifest={(data) => <ConnectorView data={data.manifest} />}
          onAccept={(data) => {
            setGeneratedManifests((m) => ({ ...m, connector: data.manifest }));
            setCachedEnvelopes((c) => ({ ...c, connector: data }));
            setPhase("swarm");
          }}
        />
      )}

      {/* Phase 3 · Swarm */}
      {phase === "swarm" && (
        <GenerateManifestPhase
          title={PHASE_LABELS.swarm.title}
          description={PHASE_LABELS.swarm.description}
          icon={Bot}
          skipInference={skipInference}
          cached={cachedEnvelopes.swarm as never}
          generate={() => opOmegaOnboardingApi.generateSwarm(selectedCompanyId, skipInference)}
          renderManifest={(data) => (
            <SwarmOrgChart
              agents={data.manifest.agents as never}
              topology={data.manifest.topology}
              bundleAllocation={data.manifest.bundle_allocation_initial}
            />
          )}
          onAccept={(data) => {
            setGeneratedManifests((m) => ({ ...m, swarm: data.manifest }));
            setCachedEnvelopes((c) => ({ ...c, swarm: data }));
            setPhase("workflow");
          }}
        />
      )}

      {/* Phase 4 · Workflow */}
      {phase === "workflow" && (
        <WorkflowPhase
          companyId={selectedCompanyId}
          skipInference={skipInference}
          onAccept={(m) => {
            setGeneratedManifests((prev) => ({ ...prev, workflow: m }));
            setPhase("kpi_verify");
          }}
        />
      )}

      {/* KPI verification before MC */}
      {phase === "kpi_verify" && (
        <KPIVerifyPhase
          companyId={selectedCompanyId}
          initialKpis={
            (status?.responses?.pillar_3 as { kpi_snapshot_initial?: Record<string, unknown> } | null)
              ?.kpi_snapshot_initial ?? null
          }
          onDone={() => setPhase("finalize")}
        />
      )}

      {/* Finalize */}
      {phase === "finalize" && (
        <GenerateManifestPhase
          title={PHASE_LABELS.finalize.title}
          description={PHASE_LABELS.finalize.description}
          icon={Gauge}
          skipInference={skipInference}
          cached={cachedEnvelopes.finalize as never}
          generate={() => opOmegaOnboardingApi.complete({ companyId: selectedCompanyId, skipInference })}
          renderManifest={(data) => (
            <CompanyView
              data={data.manifest}
              stage={(status?.responses?.pillar_3 as { stage?: string } | null)?.stage}
            />
          )}
          onAccept={(data) => {
            setGeneratedManifests((m) => ({ ...m, company: data.manifest }));
            setCachedEnvelopes((c) => ({ ...c, finalize: data }));
            setPhase("materialize");
          }}
          acceptLabel="Accept imprint"
        />
      )}

      {/* Materialize */}
      {phase === "materialize" && (
        <MaterializePhase
          companyId={selectedCompanyId}
          status={status}
          onDone={(company) => {
            setPhase("done");
            if (company) {
              setSelectedCompanyId(company.id, { source: "manual" });
              navigate(`/${company.issuePrefix}/dashboard`);
            } else {
              navigate("/dashboard");
            }
          }}
        />
      )}

      {phase === "done" && (
        <Card className="p-6 text-center">
          <CheckCircle2 className="mx-auto size-8 text-emerald-500" />
          <div className="mt-2 text-lg font-semibold">Your team is live</div>
          <div className="mt-1 text-sm text-muted-foreground">
            Every external write is held for your review for the first 14 days. Approve them as they arrive.
          </div>
        </Card>
      )}
    </div>
  );
}

/**
 * Fresh user with no selected company landed at /omega-onboarding (e.g. from
 * Dashboard's empty-state or Layout's auto-redirect), OR they landed with a
 * complete company auto-selected from localStorage and the right semantic is
 * "they want a new onboarding, not to revisit step 6 of someone else's flow."
 *
 * Auto-triggers handleStartFresh via a one-shot effect so we don't loop on
 * creation failure. If creation fails the operator sees a retry button.
 */
function FreshUserBootstrap({
  creatingFresh,
  onStart,
  reason,
}: {
  creatingFresh: boolean;
  onStart: () => Promise<void>;
  reason: "no_company" | "prior_company_complete";
}) {
  const triggered = useRef(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (triggered.current) return;
    triggered.current = true;
    onStart().catch((e) => setError(translateBootstrapError(e)));
  }, [onStart]);

  if (error) {
    return (
      <div className="mx-auto max-w-3xl space-y-4 p-8">
        <div className="rounded-md border border-red-500/40 bg-red-500/5 p-4 text-sm">
          <div className="font-semibold text-red-700 dark:text-red-400">Setup failed</div>
          <div className="mt-1 text-muted-foreground">{error}</div>
        </div>
        <button
          type="button"
          onClick={() => {
            triggered.current = false;
            setError(null);
            onStart().catch((e) => setError(translateBootstrapError(e)));
          }}
          className="rounded-md border px-3 py-1.5 text-sm hover:bg-accent"
        >
          Try again
        </button>
      </div>
    );
  }

  const message =
    reason === "prior_company_complete"
      ? "Starting a new onboarding…"
      : creatingFresh
        ? "Setting up your workspace…"
        : "Preparing onboarding…";

  return (
    <div className="mx-auto max-w-3xl flex items-center gap-2 p-8 text-sm text-muted-foreground">
      <Loader2 className="size-4 animate-spin" />
      {message}
    </div>
  );
}

/**
 * Convert a thrown error from `handleStartFresh` into operator-readable copy.
 * Raw fetch errors and stack traces are useless to a fresh user; map common
 * cases to actionable language.
 */
function translateBootstrapError(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.status === 401 || err.status === 403) {
      return "Your session looks signed-out. Refresh the page to sign back in, then try again.";
    }
    if (err.status === 409) {
      return "A conflicting onboarding draft already exists. Refresh and try again — we'll resume the existing draft.";
    }
    if (err.status >= 500) {
      return "The server hit an error setting up your workspace. Wait a moment and try again — if this persists, check the dev server logs.";
    }
    return err.message;
  }
  if (err instanceof TypeError && /fetch|network/i.test(err.message)) {
    return "Couldn't reach the server. Check your connection and try again.";
  }
  if (err instanceof Error) return err.message;
  return "Failed to set up your workspace.";
}
