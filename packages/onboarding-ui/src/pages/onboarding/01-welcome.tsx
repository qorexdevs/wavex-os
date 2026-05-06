import { useOnboarding } from "../../store";
import { NavButtons } from "../../components/NavButtons";

const INDUSTRIES = [
  "AI / ML / SaaS",
  "Concierge / Hospitality",
  "E-commerce / Retail",
  "Real Estate",
  "Healthcare / Wellness",
  "Finance / Crypto",
  "Travel / Tourism",
  "Education / EdTech",
  "Media / Content",
  "Other",
];

export default function Welcome() {
  const { companyName, industry, setCompanyName, setIndustry } = useOnboarding();
  const canProceed = companyName.trim().length > 0 && industry.length > 0;

  return (
    <>
      <h1>Welcome to WaveX OS</h1>
      <p className="text-dim" style={{ fontSize: 16, marginBottom: "2rem" }}>
        Let's build your AI agent company. 11 steps, ~45 minutes. We'll define your KPIs,
        pick agent templates, wire connectors, and spawn the fleet on your machine.
      </p>

      <div className="card">
        <label style={{ display: "block", marginBottom: "1.5rem" }}>
          <div style={{ marginBottom: "0.5rem" }}>Company name</div>
          <input
            type="text"
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            placeholder="e.g. Acme Concierge"
            autoFocus
          />
        </label>

        <label style={{ display: "block" }}>
          <div style={{ marginBottom: "0.5rem" }}>Industry</div>
          <select value={industry} onChange={(e) => setIndustry(e.target.value)}>
            <option value="">Pick an industry...</option>
            {INDUSTRIES.map((i) => (
              <option key={i} value={i}>{i}</option>
            ))}
          </select>
          <p className="text-dim" style={{ fontSize: 13, marginTop: "0.5rem" }}>
            We use this to suggest KPIs + a default org tree. You can override anything later.
          </p>
        </label>
      </div>

      <NavButtons next="goal" nextDisabled={!canProceed} nextLabel="Define your goal →" />
    </>
  );
}
