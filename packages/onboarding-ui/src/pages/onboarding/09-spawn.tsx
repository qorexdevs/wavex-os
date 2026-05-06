import { NavButtons } from "../../components/NavButtons";

export default function Spawn() {
  return (
    <>
      <h1>Spawning your company</h1>
      <p className="text-dim" style={{ fontSize: 16, marginBottom: "2rem" }}>
        Phase C: this page streams progress from the local Paperclip server (SSE) as agents
        get created, skills get distributed, KPIs get registered, connectors get wired.
      </p>
      <div className="card">
        <pre style={{ margin: 0, fontSize: 13, lineHeight: 1.8 }}>
{`✓ Creating database tables (Drizzle migrations)
✓ Spawning CEO (df8e265c-...)
✓ Spawning Chief of Staff
✓ Spawning CMO
... (one line per agent)
✓ Distributing skills + KPI ownership
✓ Wiring connectors
✓ Linking Claude Max OAuth via wrapper
✓ Smoke test: 1 dummy heartbeat per agent
✓ All agents idle and ready`}
        </pre>
      </div>
      <NavButtons back="manifest-review" next="handoff" nextLabel="Continue to handoff →" />
    </>
  );
}
