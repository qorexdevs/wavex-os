/** Step 2 of the Avatar branch — OAuth grid (mocked in v1). Operator clicks
 *  Connect on any combination of the 8 supported providers; clicking
 *  simulates a successful connection and records a stub credential. They
 *  need at least 1 connected to proceed, or they can skip everything and
 *  wire tools later from the dashboard. */

import { useState } from "react";
import { opOmegaOnboardingApi, ApiError } from "../../lib/api";
import type { AvatarToolConnection } from "../../state/onboarding-reducer";

interface Provider {
  id: string;
  label: string;
  icon: string;
}

const PROVIDERS: Provider[] = [
  { id: "gmail",           label: "Gmail",           icon: "✉️" },
  { id: "google_calendar", label: "Google Calendar", icon: "📅" },
  { id: "slack",           label: "Slack",           icon: "💬" },
  { id: "notion",          label: "Notion",          icon: "📓" },
  { id: "linear",          label: "Linear",          icon: "📋" },
  { id: "github",          label: "GitHub",          icon: "🐙" },
  { id: "twilio_sms",      label: "Twilio SMS",      icon: "📱" },
  { id: "hubspot",         label: "HubSpot",         icon: "🧲" },
];

interface Props {
  avatarId: string;
  initialConnected: AvatarToolConnection[];
  onConnected: (connection: AvatarToolConnection) => void;
  onDone: () => void;
}

export function AvatarToolsCard({ avatarId, initialConnected, onConnected, onDone }: Props) {
  const [connected, setConnected] = useState<AvatarToolConnection[]>(initialConnected);
  const [busyProvider, setBusyProvider] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function isConnected(id: string): boolean {
    return connected.some((c) => c.provider === id);
  }

  async function connect(provider: string): Promise<void> {
    setBusyProvider(provider);
    setError(null);
    try {
      const r = await opOmegaOnboardingApi.connectAvatarTool(avatarId, provider);
      const justAdded = r.connected.find((c) => c.provider === provider);
      if (!justAdded) throw new Error("connect did not record");
      setConnected(r.connected);
      onConnected(justAdded);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : (e as Error).message);
    } finally {
      setBusyProvider(null);
    }
  }

  const count = connected.length;
  const ready = count >= 1;

  return (
    <div style={{ marginTop: "0.5rem", display: "flex", flexDirection: "column", gap: "0.85rem" }}>
      <div className="text-dim" style={{ fontSize: 12 }}>
        Connect the tools you live in. Your avatar reads from them and writes back
        on your behalf.
      </div>
      <div style={{
        padding: "0.55rem 0.7rem",
        background: "color-mix(in srgb, var(--warning) 8%, transparent)",
        border: "1px solid color-mix(in srgb, var(--warning) 30%, transparent)",
        borderRadius: 6,
        fontSize: 11,
        color: "var(--warning)",
        lineHeight: 1.55,
      }}>
        <strong>Beta</strong> · OAuth is mocked in this build. Clicking Connect
        registers your intent and unlocks the next step. Real authentication
        wires in from the dashboard.
      </div>
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))",
        gap: "0.55rem",
      }}>
        {PROVIDERS.map((p) => {
          const on = isConnected(p.id);
          const busy = busyProvider === p.id;
          return (
            <div
              key={p.id}
              style={{
                padding: "0.6rem 0.7rem",
                background: on ? "color-mix(in srgb, var(--accent) 8%, transparent)" : "var(--bg)",
                border: `1px solid ${on ? "color-mix(in srgb, var(--accent) 45%, transparent)" : "var(--border)"}`,
                borderRadius: 8,
                display: "flex",
                flexDirection: "column",
                gap: "0.35rem",
                transition: "background 0.15s, border-color 0.15s",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                <span style={{ fontSize: 16, lineHeight: 1 }} aria-hidden>{p.icon}</span>
                <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text)" }}>{p.label}</span>
              </div>
              <button
                type="button"
                onClick={() => void connect(p.id)}
                disabled={busy || on}
                style={{
                  padding: "0.3rem 0.55rem",
                  borderRadius: 5,
                  border: `1px solid ${on ? "var(--accent)" : "var(--border)"}`,
                  background: on ? "var(--accent)" : "transparent",
                  color: on ? "var(--bg)" : "var(--text)",
                  fontSize: 11,
                  fontWeight: 600,
                  cursor: busy || on ? "default" : "pointer",
                  opacity: busy ? 0.7 : 1,
                }}
              >
                {busy ? "Connecting…" : on ? "✓ Connected (beta)" : "Connect"}
              </button>
            </div>
          );
        })}
      </div>
      {error && <div style={{ color: "var(--warning)", fontSize: 12 }}>✗ {error}</div>}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "0.25rem" }}>
        <span className="text-dim" style={{ fontSize: 12 }}>
          <span style={{ color: ready ? "var(--accent)" : "var(--text-dim)" }}>{count}</span> of 8 connected
        </span>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <button
            type="button"
            onClick={onDone}
            style={{
              padding: "0.45rem 0.85rem",
              borderRadius: 6,
              background: "transparent",
              color: "var(--text-dim)",
              border: "1px solid var(--border)",
              fontSize: 12,
              cursor: "pointer",
            }}
          >
            Skip — connect later
          </button>
          <button
            type="button"
            onClick={onDone}
            disabled={!ready}
            style={{
              padding: "0.45rem 0.95rem",
              borderRadius: 6,
              background: "var(--accent)",
              color: "var(--bg)",
              border: "none",
              fontWeight: 600,
              fontSize: 12,
              cursor: ready ? "pointer" : "not-allowed",
              opacity: ready ? 1 : 0.6,
            }}
          >
            Continue →
          </button>
        </div>
      </div>
    </div>
  );
}
