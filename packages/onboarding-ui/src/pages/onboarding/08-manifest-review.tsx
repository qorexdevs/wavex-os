import { useOnboarding } from "../../store";
import { NavButtons } from "../../components/NavButtons";

export default function ManifestReview() {
  const state = useOnboarding();
  const manifest = {
    company: { name: state.companyName, industry: state.industry },
    goal: { kpiId: state.goalKpiId, current: state.goalCurrent, target: state.goalTarget, days: state.goalWindowDays },
    supportingKpis: state.supportingKpis,
    connectors: Object.fromEntries(Object.entries(state.connectors).filter(([_, v]) => v.status === "connected").map(([k]) => [k, "connected"])),
    agents: state.agents,
  };
  return (
    <>
      <h1>Manifest review</h1>
      <p className="text-dim" style={{ fontSize: 16, marginBottom: "2rem" }}>
        Final review before spawn. Everything below is what your local Paperclip will create.
      </p>
      <pre className="card" style={{ fontSize: 12, overflow: "auto", margin: 0 }}>
        {JSON.stringify(manifest, null, 2)}
      </pre>
      <NavButtons back="customize-chat" next="spawn" nextLabel="Spawn my company →" />
    </>
  );
}
