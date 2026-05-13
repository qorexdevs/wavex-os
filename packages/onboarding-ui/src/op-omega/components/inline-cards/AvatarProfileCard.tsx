/** Step 1 of the Avatar branch — captures the operator's profile so the
 *  avatar has an identity (and a working-hours window for time-aware
 *  automations). Submits to POST /op-omega/onboarding/avatar which creates
 *  the on-disk avatar record and returns its id. */

import { useEffect, useMemo, useState } from "react";
import { opOmegaOnboardingApi, ApiError } from "../../lib/api";
import type { AvatarProfile } from "../../state/onboarding-reducer";

interface Props {
  onSubmitted: (profile: AvatarProfile, avatarId: string) => void;
}

const COMMON_TZS = [
  "America/Los_Angeles",
  "America/Denver",
  "America/Chicago",
  "America/New_York",
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "Asia/Tokyo",
  "Asia/Singapore",
  "Australia/Sydney",
];

export function AvatarProfileCard({ onSubmitted }: Props) {
  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("17:00");
  const detectedTz = useMemo(() => {
    try { return Intl.DateTimeFormat().resolvedOptions().timeZone; } catch { return "UTC"; }
  }, []);
  const [tz, setTz] = useState(detectedTz);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Make sure detected tz is in the dropdown so the operator sees it as the
  // default. The dropdown is editable so any IANA zone works.
  const tzOptions = useMemo(() => {
    const set = new Set(COMMON_TZS);
    if (detectedTz) set.add(detectedTz);
    return Array.from(set).sort();
  }, [detectedTz]);

  useEffect(() => { setTz(detectedTz); }, [detectedTz]);

  const ready = name.trim().length > 0 && role.trim().length > 0 && startTime < endTime;

  async function submit(): Promise<void> {
    setSubmitting(true);
    setError(null);
    try {
      const profile: AvatarProfile = {
        name: name.trim(),
        role: role.trim(),
        workingHours: [startTime, endTime],
        tz,
      };
      const r = await opOmegaOnboardingApi.createAvatar(profile);
      onSubmitted(profile, r.avatarId);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : (e as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={{ marginTop: "0.5rem", display: "flex", flexDirection: "column", gap: "0.85rem" }}>
      <div className="text-dim" style={{ fontSize: 12 }}>
        Tell me who you are. Your avatar uses this to time itself to your day.
      </div>
      <Field label="Name">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Alex Founder"
          autoFocus
          style={input}
        />
      </Field>
      <Field label="Role">
        <input
          type="text"
          value={role}
          onChange={(e) => setRole(e.target.value)}
          placeholder="Founder · Indie hacker · CTO · Designer · …"
          style={input}
        />
      </Field>
      <Field label="Working hours">
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} style={{ ...input, width: 110 }} />
          <span className="text-dim" style={{ fontSize: 12 }}>to</span>
          <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} style={{ ...input, width: 110 }} />
        </div>
      </Field>
      <Field label="Timezone">
        <select value={tz} onChange={(e) => setTz(e.target.value)} style={{ ...input, paddingRight: "0.5rem" }}>
          {tzOptions.map((z) => (
            <option key={z} value={z}>{z}</option>
          ))}
        </select>
      </Field>
      {error && <div style={{ color: "var(--warning)", fontSize: 12 }}>✗ {error}</div>}
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <button
          type="button"
          onClick={() => void submit()}
          disabled={!ready || submitting}
          style={{
            padding: "0.45rem 0.95rem",
            borderRadius: 6,
            background: "var(--accent)",
            color: "var(--bg)",
            border: "none",
            fontWeight: 600,
            fontSize: 12,
            cursor: submitting ? "wait" : ready ? "pointer" : "not-allowed",
            opacity: ready && !submitting ? 1 : 0.6,
          }}
        >
          {submitting ? "Creating…" : "Continue →"}
        </button>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ fontSize: 11, fontWeight: 600, marginBottom: "0.3rem", color: "var(--text-dim)" }}>
        {label}
      </div>
      {children}
    </div>
  );
}

const input: React.CSSProperties = {
  width: "100%",
  padding: "0.45rem 0.65rem",
  background: "var(--bg)",
  border: "1px solid var(--border)",
  borderRadius: 6,
  color: "var(--text)",
  fontSize: 13,
  outline: "none",
};
