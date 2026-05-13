/** Post-activate "what's next?" CTA card.
 *
 *  After a customer finishes onboarding they land on Mission Control with
 *  KPIs + a fleet graph but no obvious next step. The fleet is live on
 *  mock-core (or whatever Paperclip backend the customer pointed at) and
 *  runs on a heartbeat schedule — but the customer doesn't know that.
 *
 *  This card surfaces:
 *    - The fleet is LIVE: heartbeat cadence
 *    - Where to watch the first cycle: Paperclip dashboard link
 *    - A "Force first cycle" affordance for customers who don't want to
 *      wait for the next heartbeat tick
 *
 *  Lightweight on purpose — no inference call, no per-frame polling. */

import { useEffect, useState } from "react";
import { useCompany } from "../../op-omega/lib/CompanyContext";

interface HandoffState {
  paperclipUrl: string | null;
  paperclipCompanyId: string | null;
  handedOff: boolean;
  agentsTotal: number;
  agentsReady: number;
}

export function InceptionCTA() {
  const { companyId } = useCompany();
  const [state, setState] = useState<HandoffState | null>(null);
  const [forceBusy, setForceBusy] = useState(false);
  const [forceResult, setForceResult] = useState<string | null>(null);

  useEffect(() => {
    if (!companyId) { setState(null); return; }
    let cancelled = false;
    void (async () => {
      // Best-effort probe — we ask /api/companies/<id>/agents to count
      // ready slots, and /api/instance/<id>/handoff for the paperclip URL.
      // Either failing is OK; the CTA degrades to a static "fleet is live"
      // message rather than dead-ending the customer.
      let agentsTotal = 0;
      let agentsReady = 0;
      let paperclipUrl: string | null = null;
      let paperclipCompanyId: string | null = null;
      try {
        const r = await fetch(`/api/companies/${encodeURIComponent(companyId)}/agents`);
        if (r.ok) {
          const arr = (await r.json()) as Array<{ status: string }>;
          agentsTotal = arr.length;
          agentsReady = arr.filter((a) => a.status === "ready" || a.status === "active" || a.status === "idle").length;
        }
      } catch { /* mock-core may not expose this — ignore */ }
      try {
        const r = await fetch(`/api/instance/${encodeURIComponent(companyId)}/handoff`);
        if (r.ok) {
          const j = (await r.json()) as { ok: boolean; handoff?: HandoffState };
          if (j.handoff) {
            paperclipUrl = j.handoff.paperclipUrl;
            paperclipCompanyId = j.handoff.paperclipCompanyId;
          }
        }
      } catch { /* endpoint may not exist yet — ignore */ }
      if (cancelled) return;
      setState({
        paperclipUrl,
        paperclipCompanyId,
        handedOff: Boolean(paperclipUrl && paperclipCompanyId),
        agentsTotal,
        agentsReady,
      });
    })();
    return () => { cancelled = true; };
  }, [companyId]);

  if (!companyId || !state) return null;

  const paperclipLink = state.paperclipUrl && state.paperclipCompanyId
    ? `${state.paperclipUrl}/companies/${encodeURIComponent(state.paperclipCompanyId)}`
    : (state.paperclipUrl ?? "http://localhost:5174");

  async function forceFirstCycle(): Promise<void> {
    if (!companyId) return;
    setForceBusy(true);
    setForceResult(null);
    try {
      const r = await fetch(`/api/companies/${encodeURIComponent(companyId)}/trigger-heartbeats`, {
        method: "POST",
      });
      if (r.ok) {
        const j = (await r.json()) as { ok: boolean; triggered?: number };
        setForceResult(`Triggered ${j.triggered ?? 0} heartbeats — refresh the fleet panel below to see new activity.`);
      } else {
        setForceResult(`Trigger endpoint returned HTTP ${r.status}. Fleet still runs on its normal cadence.`);
      }
    } catch (e) {
      setForceResult(`Couldn't reach trigger endpoint: ${(e as Error).message}. Fleet still runs on its normal cadence.`);
    } finally {
      setForceBusy(false);
    }
  }

  return (
    <div className="card" style={{
      marginBottom: "2.5rem",
      borderColor: "var(--accent)",
      background: "color-mix(in srgb, var(--accent) 6%, var(--surface))",
      padding: "1.1rem 1.25rem",
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "1rem", flexWrap: "wrap" }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontSize: 11, color: "var(--accent)", fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase", marginBottom: 4 }}>
            Inception · your fleet is live
          </div>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>
            {state.agentsReady > 0
              ? `${state.agentsReady} of ${state.agentsTotal} agents ready · first cycle starts on the next heartbeat tick`
              : "Your fleet is spawning · agents will start their first cycles within minutes"}
          </div>
          <div className="text-dim" style={{ fontSize: 12, lineHeight: 1.55 }}>
            {state.handedOff
              ? "Watch every issue, comment, and KPI snapshot live on the Paperclip dashboard."
              : "Run Paperclip alongside wavex-os to get a real-time fleet dashboard. Defaults to localhost:5174."}
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem", alignItems: "stretch" }}>
          <a
            href={paperclipLink}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              padding: "0.55rem 0.9rem",
              borderRadius: 6,
              background: "var(--accent)",
              color: "var(--bg)",
              fontWeight: 600,
              fontSize: 12,
              textDecoration: "none",
              textAlign: "center",
            }}
          >
            Open Paperclip Dashboard ↗
          </a>
          <button
            type="button"
            onClick={() => void forceFirstCycle()}
            disabled={forceBusy}
            style={{
              padding: "0.4rem 0.9rem",
              borderRadius: 6,
              background: "transparent",
              border: "1px solid var(--border)",
              color: "var(--text-dim)",
              fontSize: 11,
              cursor: forceBusy ? "not-allowed" : "pointer",
            }}
            title="Forces every agent in the fleet to run one heartbeat immediately instead of waiting for the next scheduled tick."
          >
            {forceBusy ? "Triggering…" : "Force first cycle now"}
          </button>
        </div>
      </div>
      {forceResult && (
        <div style={{ fontSize: 11, color: "var(--text-dim)", marginTop: "0.6rem", paddingTop: "0.5rem", borderTop: "1px solid var(--border)" }}>
          {forceResult}
        </div>
      )}
    </div>
  );
}
