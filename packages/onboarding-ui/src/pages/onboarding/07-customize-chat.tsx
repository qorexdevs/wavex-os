import { useOnboarding } from "../../store";
import { NavButtons } from "../../components/NavButtons";

export default function CustomizeChat() {
  const { customizationTokensUsed, customizationTokensCap } = useOnboarding();
  const pct = Math.round((customizationTokensUsed / customizationTokensCap) * 100);
  return (
    <>
      <h1>Customize with chat</h1>
      <p className="text-dim" style={{ fontSize: 16, marginBottom: "2rem" }}>
        Free-form chat with the WaveX OS onboarding agent. Ask things like
        "make the CMO more conservative on paid spend", "add a sales agent for B2B leads",
        or "what would you change for an EU-based concierge?"
      </p>
      <div className="card">
        <div style={{ marginBottom: "1rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: "0.25rem" }}>
            <span className="text-dim">Token budget for this session</span>
            <span className="text-dim">{customizationTokensUsed.toLocaleString()} / {customizationTokensCap.toLocaleString()} ({pct}%)</span>
          </div>
          <div style={{ height: 4, background: "var(--surface-2)", borderRadius: 2, overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${pct}%`, background: pct > 80 ? "var(--warning)" : "var(--accent)" }} />
          </div>
        </div>
        <textarea rows={4} placeholder="Ask the onboarding agent for tweaks..." style={{ resize: "vertical" }} />
        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "0.75rem" }}>
          <button disabled>Send (Phase C)</button>
        </div>
      </div>
      <NavButtons back="kpi-ownership" next="manifest-review" />
    </>
  );
}
