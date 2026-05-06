import { NavButtons } from "../../components/NavButtons";

export default function Handoff() {
  return (
    <>
      <h1>OAuth handoff</h1>
      <p className="text-dim" style={{ fontSize: 16, marginBottom: "2rem" }}>
        Bind your Claude Max subscription to your fleet. The token never leaves your machine —
        the wrapper script reads it from your keychain on every agent heartbeat.
      </p>
      <div className="card">
        <p>Claude Max plan: <strong className="text-accent">claude_max_20x</strong> (detected)</p>
        <p>Wrapper symlinks: <strong className="text-accent">8 agents wired</strong></p>
        <p>Smoke test: <strong className="text-accent">all 8 succeeded ✓</strong></p>
      </div>
      <p className="text-dim" style={{ fontSize: 13 }}>
        <strong>Phase C / D:</strong> this page becomes the real handoff:
        keychain probe → wrapper symlink → smoke heartbeat → confirm.
      </p>
      <NavButtons back="spawn" next="subscription" nextLabel="Activate System Optimizer →" />
    </>
  );
}
