/** Step 1 of the Avatar branch — captures the operator's profile so the
 *  avatar has an identity (and a working-hours window for time-aware
 *  automations). Submits to POST /wavex-os/onboarding/avatar which creates
 *  the on-disk avatar record and returns its id. */

import { useEffect, useMemo, useState } from "react";
import { wavexOsOnboardingApi, ApiError } from "../../lib/api";
import type { AvatarProfile, AvatarProfilePrefill } from "../../state/onboarding-reducer";

interface Props {
  /** Phase 5 — pre-fill from the welcome-hero T2 parse. Optional; absent
   *  means the operator either skipped the hero or T2 returned nothing. */
  initial?: AvatarProfilePrefill;
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

export function AvatarProfileCard({ initial, onSubmitted }: Props) {
  const [name, setName] = useState(initial?.name ?? "");
  const [role, setRole] = useState(initial?.role ?? "");
  const [startTime, setStartTime] = useState(initial?.working_hours?.[0] ?? "09:00");
  const [endTime, setEndTime] = useState(initial?.working_hours?.[1] ?? "17:00");
  const detectedTz = useMemo(() => {
    try { return Intl.DateTimeFormat().resolvedOptions().timeZone; } catch { return "UTC"; }
  }, []);
  const [tz, setTz] = useState(initial?.tz ?? detectedTz);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Make sure detected tz is in the dropdown so the operator sees it as the
  // default. The dropdown is editable so any IANA zone works.
  const tzOptions = useMemo(() => {
    const set = new Set(COMMON_TZS);
    if (detectedTz) set.add(detectedTz);
    return Array.from(set).sort();
  }, [detectedTz]);

  useEffect(() => {
    // Only reset to the browser-detected zone if the operator didn't
    // already get one from the welcome-hero parse (or hasn't picked one).
    if (!initial?.tz) setTz(detectedTz);
  }, [detectedTz, initial?.tz]);

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
      const r = await wavexOsOnboardingApi.createAvatar(profile);
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
