/** Step 2 of the Avatar branch — OAuth grid (mocked in v1). Operator clicks
 *  Connect on any combination of the 8 supported providers; clicking
 *  simulates a successful connection and records a stub credential. They
 *  need at least 1 connected to proceed, or they can skip everything and
 *  wire tools later from the dashboard. */

import { useState } from "react";
import { opOmegaOnboardingApi, ApiError } from "../../lib/api";
import { ChipInput } from "../primitives";
import type { AvatarToolConnection } from "../../state/onboarding-reducer";

interface Provider {
  id: string;
  label: string;
  icon: string;
}

const PROVIDERS: Provider[] = [
  { id: "gmail",              label: "Gmail",              icon: "✉️" },
  { id: "outlook",            label: "Outlook",            icon: "📧" },
  { id: "google_calendar",    label: "Google Calendar",    icon: "📅" },
  { id: "microsoft_calendar", label: "Microsoft Calendar", icon: "🗓️" },
  { id: "slack",              label: "Slack",              icon: "💬" },
  { id: "notion",             label: "Notion",             icon: "📓" },
  { id: "linear",             label: "Linear",             icon: "📋" },
  { id: "github",             label: "GitHub",             icon: "🐙" },
  { id: "twilio_sms",         label: "Twilio SMS",         icon: "📱" },
  { id: "hubspot",            label: "HubSpot",            icon: "🧲" },
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
  // Phase 3 — personalization drawer state. Only Gmail in v1; other providers
  // are no-ops until per-tool drawers land in Phase 2.5.
  const [drawerOpen, setDrawerOpen] = useState<string | null>(null);
  const [vips, setVips] = useState<string[]>([]);
  const [privacyZones, setPrivacyZones] = useState<string[]>([]);
  const [signoff, setSignoff] = useState<string>("");
  const [savingMeta, setSavingMeta] = useState(false);

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
      // Auto-open the personalize drawer for mail providers on first connect.
      // The drawer captures VIPs / privacy zones / signoff that the runner
      // consumes when classifying threads for this provider. Clear the
      // shared state so an Outlook drawer doesn't reuse Gmail values.
      if (provider === "gmail" || provider === "outlook") {
        setVips([]);
        setPrivacyZones([]);
        setSignoff("");
        setDrawerOpen(provider);
      }
    } catch (e) {
      setError(e instanceof ApiError ? e.message : (e as Error).message);
    } finally {
      setBusyProvider(null);
    }
  }

  async function saveMeta(provider: string): Promise<void> {
    setSavingMeta(true);
    setError(null);
    try {
      await opOmegaOnboardingApi.setAvatarToolMeta(avatarId, provider, {
        vips, privacy_zones: privacyZones, signoff: signoff.trim() || undefined,
      });
      setDrawerOpen(null);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : (e as Error).message);
    } finally {
      setSavingMeta(false);
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
      {(drawerOpen === "gmail" || drawerOpen === "outlook") && (
        <div style={{
          padding: "0.85rem 1rem",
          background: "color-mix(in srgb, var(--accent) 5%, transparent)",
          border: "1px solid color-mix(in srgb, var(--accent) 30%, transparent)",
          borderRadius: 8,
          display: "flex", flexDirection: "column", gap: "0.75rem",
        }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "var(--accent)" }}>
              Personalize {drawerOpen === "outlook" ? "Outlook" : "Gmail"} · optional
            </div>
            <button
              type="button"
              onClick={() => setDrawerOpen(null)}
              style={{
                background: "transparent", border: "none", color: "var(--text-dim)",
                fontSize: 11, cursor: "pointer", padding: 0,
              }}
            >Skip</button>
          </div>
          <div className="text-dim" style={{ fontSize: 11, lineHeight: 1.55 }}>
            Three quick optional inputs make the first triage run smarter — VIPs
            jump to <em>now</em>, anything in a privacy zone is ignored, drafts use
            your signoff verbatim. You can change all of this on the dashboard later.
          </div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-dim)", marginBottom: "0.3rem" }}>
              VIPs (emails or domains, press Enter to add)
            </div>
            <ChipInput
              values={vips}
              onChange={setVips}
              placeholder="alex@bigfund.com, @stripe.com"
              ariaLabel={`${drawerOpen} VIPs`}
            />
          </div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-dim)", marginBottom: "0.3rem" }}>
              {drawerOpen === "outlook"
                ? "Privacy zones (folder names to never touch)"
                : "Privacy zones (labels or folders to never touch)"}
            </div>
            <ChipInput
              values={privacyZones}
              onChange={setPrivacyZones}
              placeholder="Personal, Family"
              ariaLabel={`${drawerOpen} privacy zones`}
            />
          </div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-dim)", marginBottom: "0.3rem" }}>
              Your signoff
            </div>
            <input
              type="text"
              value={signoff}
              onChange={(e) => setSignoff(e.target.value)}
              placeholder="— Alex"
              aria-label={`${drawerOpen} signoff`}
              style={{
                width: "100%", padding: "0.45rem 0.6rem",
                background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 6,
                color: "var(--text)", fontSize: 12, fontFamily: "inherit", outline: "none",
              }}
            />
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <button
              type="button"
              onClick={() => void saveMeta(drawerOpen)}
              disabled={savingMeta}
              style={{
                padding: "0.35rem 0.85rem", borderRadius: 6,
                background: "var(--accent)", color: "var(--bg)", border: "none",
                fontWeight: 600, fontSize: 12,
                cursor: savingMeta ? "wait" : "pointer", opacity: savingMeta ? 0.6 : 1,
              }}
            >
              {savingMeta ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
      )}

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
