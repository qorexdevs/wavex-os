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

/** Probe whether Paperclip is actually reachable on localhost:5174 (the
 *  standard dev port). We avoid CORS by hitting the no-cors mode — if
 *  fetch resolves at all (even with opaque response), the server exists.
 *  We give up after 1.5s so the CTA renders fast either way. */
async function probePaperclipLocal(): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 1500);
    await fetch("http://localhost:5174/", { mode: "no-cors", signal: controller.signal });
    clearTimeout(timer);
    return true;
  } catch {
    return false;
  }
}

export function InceptionCTA() {
  const { companyId } = useCompany();
  const [state, setState] = useState<HandoffState | null>(null);
  const [localPaperclipReachable, setLocalPaperclipReachable] = useState<boolean | null>(null);
  const [forceBusy, setForceBusy] = useState(false);
  const [forceResult, setForceResult] = useState<string | null>(null);

  useEffect(() => {
    if (!companyId) { setState(null); return; }
    let cancelled = false;
    void (async () => {
      // Best-effort probe — we ask /api/companies/<id>/agents to count
      // ready slots, and /api/instance/<id>/handoff for the paperclip URL.
      // Either failing is OK; the CTA degrades gracefully.
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
      // Only probe localhost when we DON'T already have a configured
      // handoff URL — otherwise we'd waste the round-trip.
      if (!paperclipUrl) {
        const reachable = await probePaperclipLocal();
        if (!cancelled) setLocalPaperclipReachable(reachable);
      }
    })();
    return () => { cancelled = true; };
  }, [companyId]);

  if (!companyId || !state) return null;

  // Resolve the dashboard link only when we have a real, reachable target.
  // - configured handoff (paperclipUrl set) → trust it
  // - else if localhost:5174 probed reachable → use it
  // - else show no link (avoid the dead-localhost ERR_CONNECTION_REFUSED
  //   the operator hit the first time around).
  const paperclipLink: string | null = state.paperclipUrl && state.paperclipCompanyId
    ? `${state.paperclipUrl}/companies/${encodeURIComponent(state.paperclipCompanyId)}`
    : state.paperclipUrl
      ? state.paperclipUrl
      : localPaperclipReachable
        ? "http://localhost:5174"
        : null;

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

  // Three render branches:
  //   1. paperclipLink set → primary CTA = "Open Paperclip Dashboard ↗"
  //   2. paperclipLink null + probe still resolving → show neutral status
  //   3. paperclipLink null + probe confirmed unreachable → show setup
  //      guidance (Paperclip GitHub link), NOT a broken localhost button.
  // This kills the ERR_CONNECTION_REFUSED the operator hit on the old
  // "default to localhost:5174 regardless" behavior.
  const probeStillResolving = paperclipLink === null && localPaperclipReachable === null && !state.paperclipUrl;
  const paperclipUnreachable = paperclipLink === null && localPaperclipReachable === false;

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
              : paperclipUnreachable
                ? "Paperclip isn't running locally. Install it to watch every issue, comment, and KPI snapshot live."
                : probeStillResolving
                  ? "Checking for a local Paperclip dashboard…"
                  : "Watch every issue, comment, and KPI snapshot on your local Paperclip dashboard."}
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem", alignItems: "stretch" }}>
          {paperclipLink && (
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
          )}
          {paperclipUnreachable && (
            <a
              href="https://github.com/paperclipai/paperclip"
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
              Set up Paperclip ↗
            </a>
          )}
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
      {paperclipUnreachable && (
        <div style={{ fontSize: 11, color: "var(--text-dim)", marginTop: "0.6rem", paddingTop: "0.5rem", borderTop: "1px solid var(--border)", lineHeight: 1.55 }}>
          Quick start: <code>git clone https://github.com/paperclipai/paperclip && cd paperclip && pnpm i && pnpm dev</code> in a new terminal — Paperclip listens on <code>localhost:5174</code>. Refresh this page once it's running.
        </div>
      )}
      {forceResult && (
        <div style={{ fontSize: 11, color: "var(--text-dim)", marginTop: "0.6rem", paddingTop: "0.5rem", borderTop: "1px solid var(--border)" }}>
          {forceResult}
        </div>
      )}
    </div>
  );
}
