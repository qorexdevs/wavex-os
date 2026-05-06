import { NavButtons } from "../../components/NavButtons";

const TIERS = [
  { id: "trial",    name: "Free Trial",  price: "$0",        period: "14 days",   features: ["1 daily injection", "200K tokens/mo", "First-touch experience"] },
  { id: "founder",  name: "Founder",     price: "$29",       period: "/month",    features: ["1 daily injection", "500K tokens/mo", "Weekly deep-dive report"] },
  { id: "growth",   name: "Growth",      price: "$99",       period: "/month",    features: ["Hourly during business hours", "2M tokens/mo", "On-demand inject-now API"] },
  { id: "custom",   name: "Custom",      price: "$299",      period: "/month",    features: ["Unlimited", "Dedicated optimizer", "White-glove onboarding"] },
];

export default function Subscription() {
  return (
    <>
      <h1>System Optimizer subscription</h1>
      <p className="text-dim" style={{ fontSize: 16, marginBottom: "2rem" }}>
        Optional. Our cloud super-agent pulls your fleet state every 24h, generates a board-level
        injection, posts it as a comment to your CEO. You can self-host this — see <a href="https://github.com/aimerdoux/wavex-os/blob/main/docs/SELF_HOSTING.md" target="_blank" rel="noreferrer">SELF_HOSTING.md</a>.
      </p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "1rem" }}>
        {TIERS.map((t) => (
          <div key={t.id} className="card" style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            <h3 style={{ margin: 0 }}>{t.name}</h3>
            <div>
              <span style={{ fontSize: 28, fontWeight: 700 }}>{t.price}</span>
              <span className="text-dim"> {t.period}</span>
            </div>
            <ul style={{ padding: 0, margin: 0, listStyle: "none", fontSize: 13, color: "var(--text-dim)", flex: 1 }}>
              {t.features.map((f) => <li key={f} style={{ padding: "0.25rem 0" }}>✓ {f}</li>)}
            </ul>
            <button className={t.id === "founder" ? "" : "secondary"} disabled>
              {t.id === "trial" ? "Start trial" : "Subscribe"}
            </button>
          </div>
        ))}
      </div>
      <p className="text-dim" style={{ fontSize: 13, marginTop: "2rem" }}>
        <strong>Phase F:</strong> Stripe checkout integration. For now, all buttons are stubs.
      </p>
      <div className="nav-buttons">
        <a href="/onboarding/handoff"><button className="secondary">← Back</button></a>
        <a href="/"><button>Skip — go to Mission Control</button></a>
      </div>
    </>
  );
}
