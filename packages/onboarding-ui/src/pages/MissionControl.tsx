import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import type { Session } from "@supabase/supabase-js";
import { HealthStrip } from "../components/mission/HealthStrip";
import { KpiBoard } from "../components/mission/KpiBoard";
import { FleetGraph } from "../components/mission/FleetGraph";
import { PrivacyPanel } from "../components/PrivacyPanel";
import { useCompany } from "../op-omega/lib/CompanyContext";
import { getSupabase } from "../lib/supabase";

interface CompaniesPayload { ok: boolean; companies: Array<{ id: string; name: string }>; }

function CompanyPicker() {
  const { companyId, setCompanyId } = useCompany();
  const q = useQuery<CompaniesPayload>({
    queryKey: ["companies"],
    queryFn: async () => {
      const r = await fetch("/api/companies");
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.json();
    },
    refetchInterval: 60_000,
  });
  const companies = q.data?.companies ?? [];

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <span className="text-dim" style={{ fontSize: 12 }}>Company:</span>
      <select
        value={companyId ?? ""}
        onChange={(e) => setCompanyId(e.target.value || null)}
        style={{ fontSize: 13, padding: "4px 8px", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 4 }}
      >
        <option value="">— select —</option>
        {companies.map((c) => (
          <option key={c.id} value={c.id}>{c.name}</option>
        ))}
      </select>
      <Link to="/onboarding" style={{ fontSize: 12 }}>+ New</Link>
    </div>
  );
}

export default function MissionControl() {
  const { companyId } = useCompany();
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    const supabase = getSupabase();
    if (!supabase) return;
    void supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)" }}>
      <header style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "1rem 2rem",
        borderBottom: "1px solid var(--border)",
        background: "var(--surface)",
        position: "sticky",
        top: 0,
        zIndex: 10,
      }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: "0.75rem" }}>
          <span style={{ fontWeight: 700, fontSize: 16, letterSpacing: "-0.01em" }}>WaveX OS</span>
          <span className="text-dim" style={{ fontSize: 12 }}>· Mission Control</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "1.25rem" }}>
          <CompanyPicker />
          <HealthStrip />
        </div>
      </header>

      <main style={{ maxWidth: 1200, margin: "0 auto", padding: "2rem" }}>
        {!companyId && (
          <div className="card" style={{
            borderColor: "var(--accent)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "1rem",
            marginBottom: "2rem",
          }}>
            <div>
              <strong>No company selected.</strong>{" "}
              <span className="text-dim">Pick one from the dropdown or start onboarding for a new one.</span>
            </div>
            <Link to="/onboarding">
              <button>Start onboarding →</button>
            </Link>
          </div>
        )}

        <div style={{ marginBottom: "2.5rem" }}>
          <KpiBoard />
        </div>

        <div style={{ marginBottom: "2.5rem" }}>
          <FleetGraph />
        </div>

        <div style={{ marginBottom: "2.5rem" }}>
          <PrivacyPanel session={session} />
        </div>

        <div className="card">
          <h3 style={{ marginTop: 0, fontSize: 14, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
            Coming next
          </h3>
          <ul style={{ margin: 0, paddingLeft: "1.25rem", color: "var(--text-dim)", lineHeight: 1.8, fontSize: 13 }}>
            <li>Workflows queue (issues by status, filterable)</li>
            <li>Approvals tray (board approvals routed via Telegram + UI)</li>
            <li>Workspace tray (ngrok status, Composio health, etc.)</li>
            <li>Real Paperclip core in place of mock-core</li>
            <li>System Optimizer daily injections</li>
          </ul>
        </div>

        <p className="text-dim" style={{ fontSize: 11, marginTop: "2rem", textAlign: "center" }}>
          WaveX OS · MIT · <a href="https://github.com/aimerdoux/wavex-os" target="_blank" rel="noreferrer">github.com/aimerdoux/wavex-os</a>
        </p>
      </main>
    </div>
  );
}
