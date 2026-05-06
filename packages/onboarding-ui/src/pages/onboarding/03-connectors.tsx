import { useOnboarding } from "../../store";
import { NavButtons } from "../../components/NavButtons";

const CONNECTORS = [
  { id: "claude-max", label: "Claude Max",  required: true,  desc: "Powers your agents' inference. Read once from your keychain." },
  { id: "telegram",   label: "Telegram",    required: false, desc: "Board approval routing + alerts via @TheGeniexbot-style helper." },
  { id: "ngrok",      label: "ngrok",       required: false, desc: "Tunnel for the optional cloud System Optimizer." },
  { id: "composio",   label: "Composio",    required: false, desc: "Meta Ads / Google Ads / Reddit / Twitter via one OAuth." },
  { id: "stripe",     label: "Stripe",      required: false, desc: "Customer-side billing connector + subscription management." },
  { id: "supabase",   label: "Supabase",    required: false, desc: "Most common BaaS for customer apps." },
  { id: "github",     label: "GitHub",      required: false, desc: "PRs + issues for engineering agents." },
];

export default function Connectors() {
  const { connectors, setConnectorStatus } = useOnboarding();

  const claudeMaxConnected = connectors["claude-max"]?.status === "connected";

  // PHASE C: each "Connect" button will trigger a real flow:
  //  - claude-max → POST localhost:3100/oauth/claude-max/probe (reads keychain)
  //  - telegram   → prompt for bot token + chat ID
  //  - composio   → OAuth handshake to dashboard.composio.dev
  //  - ngrok      → prompt for authtoken
  //  - stripe     → API key prompt
  //  - supabase   → URL + service role key prompt
  //  - github     → PAT prompt OR app install
  // For now, clicking "Connect" stubs the connection.

  function stubConnect(id: string) {
    setConnectorStatus(id, { status: "connected", detail: "stubbed (Phase C will wire real flow)" });
  }

  return (
    <>
      <h1>Connect your accounts</h1>
      <p className="text-dim" style={{ fontSize: 16, marginBottom: "2rem" }}>
        <strong>Claude Max is required</strong> — your agents need it to think.
        Everything else is optional and can be added later from Mission Control.
      </p>

      {CONNECTORS.map((c) => {
        const state = connectors[c.id];
        const isConnected = state?.status === "connected";
        return (
          <div key={c.id} className="card" style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600 }}>
                {c.label}
                {c.required && <span style={{ color: "var(--warning)", marginLeft: "0.5rem", fontSize: 12 }}>REQUIRED</span>}
              </div>
              <div className="text-dim" style={{ fontSize: 13, marginTop: "0.25rem" }}>{c.desc}</div>
              {state?.detail && <div className="text-dim" style={{ fontSize: 12, marginTop: "0.25rem" }}>{state.detail}</div>}
            </div>
            {isConnected ? (
              <span className="text-accent" style={{ fontSize: 14, fontWeight: 600 }}>✓ Connected</span>
            ) : (
              <button onClick={() => stubConnect(c.id)} className={c.required ? "" : "secondary"}>
                Connect
              </button>
            )}
          </div>
        );
      })}

      <NavButtons back="goal" next="org-design" nextDisabled={!claudeMaxConnected} />
    </>
  );
}
