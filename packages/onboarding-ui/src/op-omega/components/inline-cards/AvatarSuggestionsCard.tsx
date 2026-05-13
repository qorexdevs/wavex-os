/** Step 4 of the Avatar branch — server-side rule table picks 1-3
 *  automations the operator can enable on day one, based on which tools
 *  they actually connected. Operator toggles any subset (including zero)
 *  and finalizes; we then navigate to /avatar/:id. */

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { opOmegaOnboardingApi, ApiError } from "../../lib/api";
import type { AvatarAutomationSuggestion } from "../../state/onboarding-reducer";

interface Props {
  avatarId: string;
  onSuggestionsLoaded: (suggestions: AvatarAutomationSuggestion[]) => void;
  onToggle: (suggestionId: string) => void;
  enabled: string[];
  suggestions: AvatarAutomationSuggestion[];
  onFinalized: (avatarId: string) => void;
}

export function AvatarSuggestionsCard({
  avatarId, onSuggestionsLoaded, onToggle, enabled, suggestions, onFinalized,
}: Props) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(suggestions.length === 0);
  const [finalizing, setFinalizing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (suggestions.length > 0) return;
    let alive = true;
    void (async () => {
      try {
        const r = await opOmegaOnboardingApi.getAvatarSuggestions(avatarId);
        if (!alive) return;
        onSuggestionsLoaded(r.suggestions);
      } catch (e) {
        if (!alive) return;
        setError(e instanceof ApiError ? e.message : (e as Error).message);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [avatarId, suggestions.length, onSuggestionsLoaded]);

  async function finalize(): Promise<void> {
    setFinalizing(true);
    setError(null);
    try {
      const r = await opOmegaOnboardingApi.finalizeAvatar(avatarId, enabled);
      onFinalized(r.avatarId);
      navigate(r.url);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : (e as Error).message);
      setFinalizing(false);
    }
  }

  return (
    <div style={{ marginTop: "0.5rem", display: "flex", flexDirection: "column", gap: "0.85rem" }}>
      <div className="text-dim" style={{ fontSize: 12 }}>
        Based on the tools you connected, your avatar can start with these
        automations. Enable as few or as many as you want — you can change them later.
      </div>
      {loading && (
        <div className="text-dim" style={{ fontSize: 12, padding: "0.5rem 0" }}>Loading suggestions…</div>
      )}
      {!loading && suggestions.length === 0 && (
        <div style={{
          padding: "0.6rem 0.75rem",
          background: "var(--bg)",
          border: "1px solid var(--border)",
          borderRadius: 6,
          fontSize: 12,
          color: "var(--text-dim)",
        }}>
          No automations match your connected tools yet. You can wire more from the dashboard.
        </div>
      )}
      {suggestions.map((s) => {
        const on = enabled.includes(s.id);
        return (
          <div
            key={s.id}
            style={{
              padding: "0.7rem 0.85rem",
              background: on ? "color-mix(in srgb, var(--accent) 7%, transparent)" : "var(--bg)",
              border: `1px solid ${on ? "color-mix(in srgb, var(--accent) 45%, transparent)" : "var(--border)"}`,
              borderRadius: 8,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "0.85rem",
              transition: "background 0.15s, border-color 0.15s",
            }}
          >
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text)" }}>{s.title}</div>
              <div className="text-dim" style={{ fontSize: 12, marginTop: 2, lineHeight: 1.5 }}>{s.body}</div>
              <div className="text-dim" style={{ fontSize: 10, marginTop: 4 }}>
                Uses: {s.needs.map((n) => n.replace(/_/g, " ")).join(" + ")}
              </div>
            </div>
            <button
              type="button"
              onClick={() => onToggle(s.id)}
              style={{
                padding: "0.4rem 0.85rem",
                borderRadius: 6,
                background: on ? "var(--accent)" : "transparent",
                color: on ? "var(--bg)" : "var(--text)",
                border: `1px solid ${on ? "var(--accent)" : "var(--border)"}`,
                fontWeight: 600,
                fontSize: 12,
                cursor: "pointer",
                flex: "0 0 auto",
              }}
            >
              {on ? "✓ Enabled" : "Enable"}
            </button>
          </div>
        );
      })}
      {error && <div style={{ color: "var(--warning)", fontSize: 12 }}>✗ {error}</div>}
      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "0.25rem" }}>
        <button
          type="button"
          onClick={() => void finalize()}
          disabled={loading || finalizing}
          style={{
            padding: "0.45rem 0.95rem",
            borderRadius: 6,
            background: "var(--accent)",
            color: "var(--bg)",
            border: "none",
            fontWeight: 600,
            fontSize: 12,
            cursor: finalizing ? "wait" : "pointer",
            opacity: loading || finalizing ? 0.6 : 1,
          }}
        >
          {finalizing ? "Launching…" : enabled.length > 0 ? `Launch — enable ${enabled.length} →` : "Launch — skip for now →"}
        </button>
      </div>
    </div>
  );
}
