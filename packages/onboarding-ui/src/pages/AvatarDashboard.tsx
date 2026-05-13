/** Avatar dashboard — landed on after the 5-step Avatar onboarding
 *  finishes. Single-page summary of the operator's avatar:
 *    - Header: name, role, working hours, timezone
 *    - Connected tools grid (with stub badges for v1's mock OAuth)
 *    - Voice profile summary (tone, formality, structure, delegates)
 *    - Enabled automations + the suggestions that were proposed
 *    - Empty Recent Activity (placeholder for v2 event feed)
 *
 *  The Avatar overlay is parallel to the Paperclip company dashboard at
 *  /<COMPANY>/dashboard — they share visual language but live on separate
 *  routes since the underlying data shapes are different. */

import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { opOmegaOnboardingApi, ApiError } from "../op-omega/lib/api";

interface Avatar {
  avatarId: string;
  profile: { name: string; role: string; working_hours: [string, string]; tz: string; created_at: string } | null;
  tools: Array<{ provider: string; ref: string; status: "stub" | "connected"; connected_at: string }>;
  tools_skipped: boolean;
  voice: {
    samples: string[];
    profile?: { tone: string; formality: string; structure: string; delegates: string[] };
    source?: "t2" | "stub";
  } | null;
  automations: { enabled: string[]; suggested: Array<{ id: string; title: string; body: string; needs: string[] }> } | null;
}

const PROVIDER_LABELS: Record<string, string> = {
  gmail: "Gmail",
  google_calendar: "Google Calendar",
  slack: "Slack",
  notion: "Notion",
  linear: "Linear",
  github: "GitHub",
  twilio_sms: "Twilio SMS",
  hubspot: "HubSpot",
};

export function AvatarDashboard() {
  const { id } = useParams<{ id: string }>();
  const [avatar, setAvatar] = useState<Avatar | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    let alive = true;
    void (async () => {
      try {
        const r = await opOmegaOnboardingApi.getAvatar(id);
        if (alive) setAvatar(r);
      } catch (e) {
        if (alive) setError(e instanceof ApiError ? e.message : (e as Error).message);
      }
    })();
    return () => { alive = false; };
  }, [id]);

  if (error) {
    return (
      <Shell>
        <div style={{ padding: "2rem", maxWidth: 720, margin: "0 auto" }}>
          <h2 style={{ marginTop: 0 }}>Couldn't load avatar</h2>
          <p style={{ color: "var(--warning)" }}>{error}</p>
          <Link to="/onboarding-chat">← Back to onboarding</Link>
        </div>
      </Shell>
    );
  }

  if (!avatar || !avatar.profile) {
    return (
      <Shell>
        <div style={{ padding: "2rem", maxWidth: 720, margin: "0 auto", color: "var(--text-dim)" }}>
          Loading avatar…
        </div>
      </Shell>
    );
  }

  const enabled = (avatar.automations?.enabled ?? []);
  const suggested = (avatar.automations?.suggested ?? []);
  const enabledAutomations = suggested.filter((s) => enabled.includes(s.id));
  const remainingSuggestions = suggested.filter((s) => !enabled.includes(s.id));

  return (
    <Shell>
      <div style={{ maxWidth: 1080, margin: "0 auto", padding: "2rem 1.5rem", display: "flex", flexDirection: "column", gap: "1.5rem" }}>
        {/* Header */}
        <header style={{
          padding: "1rem 1.25rem",
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: 10,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "1rem",
        }}>
          <div>
            <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--text-dim)", marginBottom: 4 }}>
              Your avatar
            </div>
            <div style={{ fontSize: 22, fontWeight: 700, color: "var(--text)" }}>
              {avatar.profile.name}
            </div>
            <div className="text-dim" style={{ fontSize: 13, marginTop: 2 }}>
              {avatar.profile.role}
              {" · "}
              <code>{avatar.profile.working_hours[0]}–{avatar.profile.working_hours[1]}</code>
              {" · "}
              {avatar.profile.tz}
            </div>
          </div>
          <Link
            to="/"
            style={{
              padding: "0.4rem 0.8rem",
              borderRadius: 6,
              border: "1px solid var(--border)",
              color: "var(--text-dim)",
              textDecoration: "none",
              fontSize: 12,
            }}
          >
            Mission Control →
          </Link>
        </header>

        <div style={{ display: "grid", gap: "1rem", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))" }}>
          {/* Tools */}
          <section style={card}>
            <SectionTitle>Connected tools ({avatar.tools.length})</SectionTitle>
            {avatar.tools.length === 0 && (
              <p className="text-dim" style={{ margin: 0, fontSize: 12 }}>
                No tools connected yet. <Link to="/onboarding-chat">Wire some.</Link>
              </p>
            )}
            <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 6 }}>
              {avatar.tools.map((t) => (
                <li key={t.provider} style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "0.45rem 0.6rem",
                  background: "var(--bg)",
                  border: "1px solid var(--border)",
                  borderRadius: 6,
                  fontSize: 12,
                }}>
                  <span>{PROVIDER_LABELS[t.provider] ?? t.provider}</span>
                  <span style={{
                    fontSize: 10,
                    padding: "0.1rem 0.45rem",
                    borderRadius: 999,
                    background: t.status === "stub" ? "color-mix(in srgb, var(--warning) 15%, transparent)" : "color-mix(in srgb, var(--accent) 15%, transparent)",
                    color: t.status === "stub" ? "var(--warning)" : "var(--accent)",
                    fontWeight: 600,
                    letterSpacing: "0.04em",
                    textTransform: "uppercase",
                  }}>
                    {t.status}
                  </span>
                </li>
              ))}
            </ul>
          </section>

          {/* Voice */}
          <section style={card}>
            <SectionTitle>Voice profile</SectionTitle>
            {avatar.voice?.profile ? (
              <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", columnGap: "0.85rem", rowGap: "0.35rem", fontSize: 12 }}>
                <Label>Tone</Label><Value>{avatar.voice.profile.tone}</Value>
                <Label>Formality</Label><Value>{avatar.voice.profile.formality}</Value>
                <Label>Structure</Label><Value>{avatar.voice.profile.structure}</Value>
                <Label>Delegates</Label><Value>{avatar.voice.profile.delegates.join(", ")}</Value>
                {avatar.voice.source === "stub" && (
                  <>
                    <span></span>
                    <span style={{ fontSize: 10, color: "var(--warning)", marginTop: 4 }}>
                      Stub profile — re-run with real T2 to personalize.
                    </span>
                  </>
                )}
              </div>
            ) : (
              <p className="text-dim" style={{ margin: 0, fontSize: 12 }}>Voice profile not yet built.</p>
            )}
          </section>

          {/* Automations */}
          <section style={card}>
            <SectionTitle>Active automations ({enabledAutomations.length})</SectionTitle>
            {enabledAutomations.length === 0 && (
              <p className="text-dim" style={{ margin: 0, fontSize: 12 }}>
                No automations enabled. Add some from the suggestions below.
              </p>
            )}
            <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 6 }}>
              {enabledAutomations.map((a) => (
                <li key={a.id} style={{
                  padding: "0.5rem 0.65rem",
                  background: "var(--bg)",
                  border: "1px solid color-mix(in srgb, var(--accent) 35%, transparent)",
                  borderRadius: 6,
                  fontSize: 12,
                }}>
                  <div style={{ fontWeight: 700 }}>{a.title}</div>
                  <div className="text-dim" style={{ fontSize: 11, marginTop: 2 }}>{a.body}</div>
                </li>
              ))}
            </ul>
          </section>
        </div>

        {/* Suggestions not yet enabled */}
        {remainingSuggestions.length > 0 && (
          <section style={card}>
            <SectionTitle>More you can enable</SectionTitle>
            <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 6 }}>
              {remainingSuggestions.map((s) => (
                <li key={s.id} style={{
                  padding: "0.5rem 0.65rem",
                  background: "var(--bg)",
                  border: "1px solid var(--border)",
                  borderRadius: 6,
                  fontSize: 12,
                }}>
                  <div style={{ fontWeight: 700 }}>{s.title}</div>
                  <div className="text-dim" style={{ fontSize: 11, marginTop: 2 }}>{s.body}</div>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Recent activity placeholder */}
        <section style={card}>
          <SectionTitle>Recent activity</SectionTitle>
          <p className="text-dim" style={{ margin: 0, fontSize: 12 }}>
            Nothing here yet. As your automations run, you'll see entries.
          </p>
        </section>

        <div className="text-dim" style={{ fontSize: 11, textAlign: "center", marginTop: "1rem" }}>
          avatar <code>{avatar.avatarId}</code>
        </div>
      </div>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)" }}>
      {children}
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 style={{
      margin: 0,
      marginBottom: "0.75rem",
      fontSize: 11,
      fontWeight: 700,
      textTransform: "uppercase",
      letterSpacing: "0.1em",
      color: "var(--text-dim)",
    }}>{children}</h3>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <span style={{ fontWeight: 600, color: "var(--text-dim)" }}>{children}</span>;
}

function Value({ children }: { children: React.ReactNode }) {
  return <span style={{ color: "var(--text)" }}>{children}</span>;
}

const card: React.CSSProperties = {
  padding: "1rem 1.25rem",
  background: "var(--surface)",
  border: "1px solid var(--border)",
  borderRadius: 10,
};
