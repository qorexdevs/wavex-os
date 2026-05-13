/** Avatar Settings page — Phase 7-C.
 *
 *  Edit anything onboarding captured + delete the avatar. Each section
 *  has its own form state and explicit Save button; no auto-save.
 *
 *  Slice 5 ships Profile + Trust + the page chrome. Voice / Tool meta /
 *  Delete sections land in slice 6.
 */

import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { opOmegaOnboardingApi, ApiError } from "../op-omega/lib/api";
import { ChipInput, RadioGroup } from "../op-omega/components/primitives";
import { isT0FastMode } from "../op-omega/lib/dev-flags";
import type { AvatarAutonomyPreset } from "../op-omega/state/onboarding-reducer";

const PROVIDER_LABELS: Record<string, string> = {
  gmail: "Gmail", outlook: "Outlook",
  google_calendar: "Google Calendar", microsoft_calendar: "Microsoft Calendar",
  slack: "Slack", notion: "Notion", linear: "Linear", github: "GitHub",
  twilio_sms: "Twilio SMS", hubspot: "HubSpot",
};

interface VoiceShape {
  samples: string[];
  profile?: { tone: string; formality: string; structure: string; delegates: string[] };
  source?: "t2" | "stub";
  signoff?: string;
  guardrails?: string[];
}

interface ToolsMetaShape {
  [provider: string]: { vips?: string[]; privacy_zones?: string[]; signoff?: string };
}

interface ProfileShape {
  name: string;
  role: string;
  working_hours: [string, string];
  tz: string;
  created_at?: string;
}

interface TrustShape {
  autonomy_preset: AvatarAutonomyPreset;
  vips: Array<{ email: string; label?: string }>;
  privacy_zones: string[];
  notify: string[];
}

const COMMON_TZS = [
  "America/Los_Angeles", "America/Denver", "America/Chicago", "America/New_York",
  "Europe/London", "Europe/Paris", "Europe/Berlin",
  "Asia/Tokyo", "Asia/Singapore", "Australia/Sydney",
];

type NotifyKey = "now_drafts" | "low_confidence" | "skill_paused" | "daily_digest";
const NOTIFY_OPTIONS: Array<{ value: NotifyKey; label: string }> = [
  { value: "now_drafts", label: "Now drafts ready" },
  { value: "low_confidence", label: "Confidence < 60%" },
  { value: "skill_paused", label: "Skill paused" },
  { value: "daily_digest", label: "Daily 8am digest" },
];

export function AvatarSettings() {
  const { id } = useParams<{ id: string }>();
  const [profile, setProfile] = useState<ProfileShape | null>(null);
  const [trust, setTrust] = useState<TrustShape | null>(null);
  const [voice, setVoice] = useState<VoiceShape | null>(null);
  const [tools, setTools] = useState<Array<{ provider: string; status: string }>>([]);
  const [toolsMeta, setToolsMeta] = useState<ToolsMetaShape>({});
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    let alive = true;
    void (async () => {
      try {
        const [avatar, trustResp] = await Promise.all([
          opOmegaOnboardingApi.getAvatar(id),
          opOmegaOnboardingApi.getAvatarTrust(id),
        ]);
        if (!alive) return;
        if (avatar.profile) setProfile(avatar.profile as ProfileShape);
        if (avatar.voice) setVoice(avatar.voice as VoiceShape);
        if (avatar.tools) setTools(avatar.tools as Array<{ provider: string; status: string }>);
        // tools_meta is on the response (added in P3) but the API helper
        // doesn't yet model it — narrow defensively.
        const meta = (avatar as unknown as { tools_meta?: ToolsMetaShape }).tools_meta;
        if (meta) setToolsMeta(meta);
        if (trustResp.trust) {
          setTrust({
            autonomy_preset: trustResp.trust.autonomy_preset,
            vips: trustResp.trust.vips,
            privacy_zones: trustResp.trust.privacy_zones,
            notify: trustResp.trust.notify,
          });
        } else {
          setTrust({ autonomy_preset: "cautious", vips: [], privacy_zones: [], notify: ["now_drafts"] });
        }
      } catch (e) {
        if (alive) setError(e instanceof ApiError ? e.message : (e as Error).message);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [id]);

  if (loading) {
    return (
      <Shell>
        <div className="text-dim" style={{ padding: "2rem", textAlign: "center" }}>Loading settings…</div>
      </Shell>
    );
  }
  if (error) {
    return (
      <Shell>
        <div style={{ padding: "2rem", maxWidth: 720, margin: "0 auto" }}>
          <h2 style={{ marginTop: 0 }}>Couldn't load settings</h2>
          <p style={{ color: "var(--warning)" }}>{error}</p>
          <Link to={`/avatar/${id}`}>← Back to dashboard</Link>
        </div>
      </Shell>
    );
  }
  if (!id || !profile || !trust) return null;

  return (
    <Shell>
      <div style={{ maxWidth: 760, margin: "0 auto", padding: "2rem 1.5rem", display: "flex", flexDirection: "column", gap: "1.25rem" }}>
        <Header avatarId={id} name={profile.name} />
        <ProfileSection
          avatarId={id}
          initial={profile}
          onSaved={(next) => setProfile(next)}
        />
        <TrustSection
          avatarId={id}
          initial={trust}
          onSaved={(next) => setTrust(next)}
        />
        <VoiceSection
          avatarId={id}
          initial={voice}
          onSaved={(next) => setVoice(next)}
        />
        {tools.length > 0 && (
          <ToolMetaSection
            avatarId={id}
            tools={tools}
            initial={toolsMeta}
            onSaved={(provider, meta) => setToolsMeta((prev) => ({ ...prev, [provider]: meta }))}
          />
        )}
        <DangerZone avatarId={id} />
      </div>
    </Shell>
  );
}

// ── Page chrome ────────────────────────────────────────────────────────

function Header({ avatarId, name }: { avatarId: string; name: string }) {
  return (
    <header style={{
      padding: "1rem 1.25rem",
      background: "var(--surface)",
      border: "1px solid var(--border)",
      borderRadius: 10,
      display: "flex", alignItems: "center", justifyContent: "space-between", gap: "1rem",
    }}>
      <div>
        <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--text-dim)", marginBottom: 4 }}>
          Avatar settings
        </div>
        <div style={{ fontSize: 20, fontWeight: 700, color: "var(--text)" }}>{name}</div>
      </div>
      <Link
        to={`/avatar/${avatarId}`}
        style={{
          padding: "0.4rem 0.8rem", borderRadius: 6, border: "1px solid var(--border)",
          color: "var(--text-dim)", textDecoration: "none", fontSize: 12,
        }}
      >
        ← Back to dashboard
      </Link>
    </header>
  );
}

// ── Profile section ────────────────────────────────────────────────────

function ProfileSection({
  avatarId, initial, onSaved,
}: {
  avatarId: string;
  initial: ProfileShape;
  onSaved: (next: ProfileShape) => void;
}) {
  const [name, setName] = useState(initial.name);
  const [role, setRole] = useState(initial.role);
  const [startTime, setStartTime] = useState(initial.working_hours[0]);
  const [endTime, setEndTime] = useState(initial.working_hours[1]);
  const [tz, setTz] = useState(initial.tz);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const tzOptions = useMemo(() => {
    const set = new Set(COMMON_TZS);
    if (initial.tz) set.add(initial.tz);
    return Array.from(set).sort();
  }, [initial.tz]);

  const dirty = name !== initial.name || role !== initial.role
    || startTime !== initial.working_hours[0] || endTime !== initial.working_hours[1]
    || tz !== initial.tz;
  const ready = name.trim().length > 0 && role.trim().length > 0 && startTime < endTime;

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const r = await opOmegaOnboardingApi.updateAvatarProfile(avatarId, {
        name: name.trim(),
        role: role.trim(),
        workingHours: [startTime, endTime],
        tz,
      });
      onSaved(r.profile as ProfileShape);
      setSavedAt(new Date().toLocaleTimeString());
    } catch (e) {
      setError(e instanceof ApiError ? e.message : (e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Section
      title="Profile"
      description="The basics your avatar uses to time itself to your day."
      saveDisabled={!dirty || !ready || saving}
      saving={saving}
      savedAt={savedAt}
      error={error}
      onSave={save}
    >
      <Field label="Name">
        <input type="text" value={name} onChange={(e) => setName(e.target.value)} style={inputStyle} />
      </Field>
      <Field label="Role">
        <input type="text" value={role} onChange={(e) => setRole(e.target.value)} style={inputStyle} />
      </Field>
      <Field label="Working hours">
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} style={{ ...inputStyle, width: 110 }} />
          <span className="text-dim" style={{ fontSize: 12 }}>to</span>
          <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} style={{ ...inputStyle, width: 110 }} />
        </div>
      </Field>
      <Field label="Timezone">
        <select value={tz} onChange={(e) => setTz(e.target.value)} style={{ ...inputStyle, paddingRight: "0.5rem" }}>
          {tzOptions.map((z) => <option key={z} value={z}>{z}</option>)}
        </select>
      </Field>
    </Section>
  );
}

// ── Trust section ──────────────────────────────────────────────────────

function TrustSection({
  avatarId, initial, onSaved,
}: {
  avatarId: string;
  initial: TrustShape;
  onSaved: (next: TrustShape) => void;
}) {
  const [preset, setPreset] = useState<AvatarAutonomyPreset>(initial.autonomy_preset);
  const [vips, setVips] = useState<string[]>(initial.vips.map((v) => v.email));
  const [privacyZones, setPrivacyZones] = useState<string[]>(initial.privacy_zones);
  const [notify, setNotify] = useState<NotifyKey[]>(initial.notify as NotifyKey[]);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const dirty = preset !== initial.autonomy_preset
    || JSON.stringify(vips) !== JSON.stringify(initial.vips.map((v) => v.email))
    || JSON.stringify(privacyZones) !== JSON.stringify(initial.privacy_zones)
    || JSON.stringify(notify) !== JSON.stringify(initial.notify);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const next = {
        autonomy_preset: preset,
        vips: vips.map((email) => ({ email })),
        privacy_zones: privacyZones,
        notify,
      };
      await opOmegaOnboardingApi.setAvatarTrust(avatarId, next);
      onSaved(next);
      setSavedAt(new Date().toLocaleTimeString());
    } catch (e) {
      setError(e instanceof ApiError ? e.message : (e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Section
      title="Trust & boundaries"
      description="How autonomous your avatar is and what's off-limits."
      saveDisabled={!dirty || saving}
      saving={saving}
      savedAt={savedAt}
      error={error}
      onSave={save}
    >
      <Field label="Autonomy">
        <RadioGroup<AvatarAutonomyPreset>
          value={preset}
          onChange={setPreset}
          options={[
            { value: "cautious", label: "Cautious", description: "Every draft waits for your approval." },
            { value: "balanced", label: "Balanced", description: "I clear obvious FYI mail on my own when I'm very confident." },
            { value: "aggressive", label: "Aggressive", description: "I send confident replies on your behalf; you review anything I'm unsure about." },
          ]}
        />
      </Field>
      <Field label="VIPs">
        <ChipInput values={vips} onChange={setVips} placeholder="alex@bigfund.com, @stripe.com" ariaLabel="VIPs" />
      </Field>
      <Field label="Privacy zones (labels or folders I should never touch)">
        <ChipInput values={privacyZones} onChange={setPrivacyZones} placeholder="Personal, Family" ariaLabel="Privacy zones" />
      </Field>
      <Field label="Notify me when">
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
          {NOTIFY_OPTIONS.map((o) => {
            const active = notify.includes(o.value);
            return (
              <button
                key={o.value}
                type="button"
                onClick={() => setNotify((prev) => prev.includes(o.value) ? prev.filter((x) => x !== o.value) : [...prev, o.value])}
                style={{
                  padding: "0.35rem 0.7rem",
                  borderRadius: 999,
                  border: `1px solid ${active ? "var(--accent)" : "var(--border)"}`,
                  background: active ? "color-mix(in srgb, var(--accent) 14%, transparent)" : "transparent",
                  color: active ? "var(--accent)" : "var(--text-dim)",
                  fontSize: 12, cursor: "pointer", fontWeight: active ? 600 : 400,
                }}
              >
                {active ? "✓ " : ""}{o.label}
              </button>
            );
          })}
        </div>
      </Field>
    </Section>
  );
}

// ── Voice section ──────────────────────────────────────────────────────

function VoiceSection({
  avatarId, initial, onSaved,
}: {
  avatarId: string;
  initial: VoiceShape | null;
  onSaved: (next: VoiceShape) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [samples, setSamples] = useState<[string, string, string]>([
    initial?.samples?.[0] ?? "",
    initial?.samples?.[1] ?? "",
    initial?.samples?.[2] ?? "",
  ]);
  const [signoff, setSignoff] = useState(initial?.signoff ?? "");
  const [guardrails, setGuardrails] = useState<string[]>(initial?.guardrails ?? []);
  const [confirming, setConfirming] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const ready = samples.every((s) => s.trim().length >= 20);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const r = await opOmegaOnboardingApi.analyzeAvatarVoice(
        avatarId, samples, isT0FastMode(),
        { signoff: signoff.trim() || undefined, guardrails: guardrails.length > 0 ? guardrails : undefined },
      );
      const next: VoiceShape = {
        samples: [...samples],
        profile: r.profile,
        source: r.source,
        signoff: r.signoff,
        guardrails: r.guardrails,
      };
      onSaved(next);
      setSavedAt(new Date().toLocaleTimeString());
      setEditing(false);
      setConfirming(false);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : (e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  // Read-only view by default.
  if (!editing) {
    return (
      <section style={card}>
        <div style={{ marginBottom: "0.75rem" }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text)", marginBottom: 4 }}>Voice</div>
          <div className="text-dim" style={{ fontSize: 12 }}>
            How your avatar writes drafts. Re-analyzing rebuilds the voice profile from scratch.
          </div>
        </div>
        {initial?.profile ? (
          <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", columnGap: "0.85rem", rowGap: "0.35rem", fontSize: 12 }}>
            <span style={{ fontWeight: 600, color: "var(--text-dim)" }}>Tone</span>
            <span>{initial.profile.tone}</span>
            <span style={{ fontWeight: 600, color: "var(--text-dim)" }}>Formality</span>
            <span>{initial.profile.formality}</span>
            <span style={{ fontWeight: 600, color: "var(--text-dim)" }}>Structure</span>
            <span>{initial.profile.structure}</span>
            <span style={{ fontWeight: 600, color: "var(--text-dim)" }}>Delegates first</span>
            <span>{initial.profile.delegates?.join(", ") || "—"}</span>
            {initial.signoff && (
              <>
                <span style={{ fontWeight: 600, color: "var(--text-dim)" }}>Signoff</span>
                <span>{initial.signoff}</span>
              </>
            )}
            {initial.guardrails && initial.guardrails.length > 0 && (
              <>
                <span style={{ fontWeight: 600, color: "var(--text-dim)" }}>Never say</span>
                <span>{initial.guardrails.join(" · ")}</span>
              </>
            )}
            {initial.source === "stub" && (
              <>
                <span></span>
                <span style={{ color: "var(--warning)", fontSize: 11 }}>
                  Stub profile — re-analyze to personalize.
                </span>
              </>
            )}
          </div>
        ) : (
          <p className="text-dim" style={{ margin: 0, fontSize: 12 }}>No voice profile built yet.</p>
        )}
        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "0.85rem" }}>
          <button
            type="button"
            onClick={() => setEditing(true)}
            style={ghostBtnStyle}
          >
            Re-analyze voice
          </button>
        </div>
      </section>
    );
  }

  // Editing view.
  return (
    <section style={card}>
      <div style={{ marginBottom: "0.75rem" }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text)", marginBottom: 4 }}>Voice (re-analyze)</div>
        <div className="text-dim" style={{ fontSize: 12 }}>
          Three samples ≥20 characters each, plus an optional signoff and guardrails.
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}>
        {[0, 1, 2].map((i) => (
          <Field key={i} label={`Sample ${i + 1}`}>
            <textarea
              value={samples[i]}
              onChange={(e) => setSamples((prev) => {
                const next: [string, string, string] = [...prev] as [string, string, string];
                next[i] = e.target.value;
                return next;
              })}
              rows={3}
              style={{ ...inputStyle, fontFamily: "inherit", lineHeight: 1.5, minHeight: 70, resize: "vertical" }}
            />
          </Field>
        ))}
        <Field label="Signoff (optional)">
          <input type="text" value={signoff} onChange={(e) => setSignoff(e.target.value)} placeholder="— Alex" style={inputStyle} />
        </Field>
        <Field label="Guardrails (optional)">
          <ChipInput values={guardrails} onChange={setGuardrails} placeholder="no apologies, no promises about timelines" max={5} ariaLabel="Guardrails" />
        </Field>
      </div>
      {confirming && (
        <div style={{
          marginTop: "0.85rem", padding: "0.6rem 0.8rem",
          background: "color-mix(in srgb, var(--warning) 10%, transparent)",
          border: "1px solid color-mix(in srgb, var(--warning) 40%, transparent)",
          borderRadius: 6, fontSize: 12, color: "var(--text)",
        }}>
          This re-runs analysis on the new samples and overwrites your current voice profile. Are you sure?
        </div>
      )}
      {error && <div style={{ color: "var(--warning)", fontSize: 12, marginTop: "0.6rem" }}>✗ {error}</div>}
      <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem", marginTop: "0.85rem", alignItems: "center" }}>
        {savedAt && !saving && <span className="text-dim" style={{ fontSize: 11 }}>Saved at {savedAt}</span>}
        <button type="button" onClick={() => { setEditing(false); setConfirming(false); }} style={ghostBtnStyle}>Cancel</button>
        {!confirming ? (
          <button
            type="button"
            onClick={() => setConfirming(true)}
            disabled={!ready}
            style={{
              padding: "0.45rem 0.95rem", borderRadius: 6,
              background: "var(--accent)", color: "var(--bg)", border: "none",
              fontWeight: 600, fontSize: 12,
              cursor: ready ? "pointer" : "default", opacity: ready ? 1 : 0.5,
            }}
          >
            Re-analyze
          </button>
        ) : (
          <button
            type="button"
            onClick={() => void save()}
            disabled={saving}
            style={{
              padding: "0.45rem 0.95rem", borderRadius: 6,
              background: "var(--warning)", color: "var(--bg)", border: "none",
              fontWeight: 600, fontSize: 12,
              cursor: saving ? "wait" : "pointer",
            }}
          >
            {saving ? "Re-analyzing…" : "Yes, overwrite"}
          </button>
        )}
      </div>
    </section>
  );
}

// ── Per-tool meta section ──────────────────────────────────────────────

function ToolMetaSection({
  avatarId, tools, initial, onSaved,
}: {
  avatarId: string;
  tools: Array<{ provider: string; status: string }>;
  initial: ToolsMetaShape;
  onSaved: (provider: string, meta: { vips?: string[]; privacy_zones?: string[]; signoff?: string }) => void;
}) {
  // Only show panels for providers where per-tool drawer makes sense
  // (mail providers today; calendar / slack don't yet capture meta).
  const editableProviders = tools.filter((t) => t.provider === "gmail" || t.provider === "outlook");
  if (editableProviders.length === 0) return null;
  return (
    <section style={card}>
      <div style={{ marginBottom: "0.75rem" }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text)", marginBottom: 4 }}>Per-tool personalization</div>
        <div className="text-dim" style={{ fontSize: 12 }}>
          VIPs, privacy zones, and signoff per mail provider. These override the global Trust settings for that provider.
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
        {editableProviders.map((t) => (
          <ProviderMetaPanel
            key={t.provider}
            avatarId={avatarId}
            provider={t.provider}
            initial={initial[t.provider] ?? {}}
            onSaved={(meta) => onSaved(t.provider, meta)}
          />
        ))}
      </div>
    </section>
  );
}

function ProviderMetaPanel({
  avatarId, provider, initial, onSaved,
}: {
  avatarId: string;
  provider: string;
  initial: { vips?: string[]; privacy_zones?: string[]; signoff?: string };
  onSaved: (meta: { vips?: string[]; privacy_zones?: string[]; signoff?: string }) => void;
}) {
  const [vips, setVips] = useState<string[]>(initial.vips ?? []);
  const [privacyZones, setPrivacyZones] = useState<string[]>(initial.privacy_zones ?? []);
  const [signoff, setSignoff] = useState(initial.signoff ?? "");
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const dirty = JSON.stringify(vips) !== JSON.stringify(initial.vips ?? [])
    || JSON.stringify(privacyZones) !== JSON.stringify(initial.privacy_zones ?? [])
    || (signoff || "") !== (initial.signoff ?? "");

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const meta = {
        vips, privacy_zones: privacyZones, signoff: signoff.trim() || undefined,
      };
      await opOmegaOnboardingApi.setAvatarToolMeta(avatarId, provider, meta);
      onSaved(meta);
      setSavedAt(new Date().toLocaleTimeString());
    } catch (e) {
      setError(e instanceof ApiError ? e.message : (e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{
      padding: "0.85rem 1rem",
      background: "var(--bg)",
      border: "1px solid var(--border)",
      borderRadius: 8,
      display: "flex", flexDirection: "column", gap: "0.7rem",
    }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text)" }}>
        {PROVIDER_LABELS[provider] ?? provider}
      </div>
      <Field label="VIPs">
        <ChipInput values={vips} onChange={setVips} placeholder="alex@bigfund.com, @stripe.com" ariaLabel={`${provider} VIPs`} />
      </Field>
      <Field label="Privacy zones">
        <ChipInput values={privacyZones} onChange={setPrivacyZones} placeholder="Personal, Family" ariaLabel={`${provider} privacy zones`} />
      </Field>
      <Field label="Signoff">
        <input type="text" value={signoff} onChange={(e) => setSignoff(e.target.value)} placeholder="— Alex" style={inputStyle} />
      </Field>
      {error && <div style={{ color: "var(--warning)", fontSize: 12 }}>✗ {error}</div>}
      <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: "0.5rem" }}>
        {savedAt && !saving && <span className="text-dim" style={{ fontSize: 11 }}>Saved at {savedAt}</span>}
        <button
          type="button"
          onClick={() => void save()}
          disabled={!dirty || saving}
          style={{
            padding: "0.35rem 0.85rem", borderRadius: 6,
            background: "var(--accent)", color: "var(--bg)", border: "none",
            fontWeight: 600, fontSize: 12,
            cursor: !dirty || saving ? "default" : "pointer",
            opacity: !dirty || saving ? 0.5 : 1,
          }}
        >
          {saving ? "Saving…" : "Save"}
        </button>
      </div>
    </div>
  );
}

// ── Danger zone (delete avatar) ────────────────────────────────────────

function DangerZone({ avatarId }: { avatarId: string }) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  async function confirmDelete() {
    setDeleting(true);
    setError(null);
    try {
      await opOmegaOnboardingApi.deleteAvatar(avatarId);
      navigate("/", { replace: true });
    } catch (e) {
      setError(e instanceof ApiError ? e.message : (e as Error).message);
      setDeleting(false);
    }
  }

  return (
    <section style={{ ...card, borderColor: "color-mix(in srgb, var(--warning) 30%, var(--border))" }}>
      <div style={{ marginBottom: "0.75rem" }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: "var(--warning)", marginBottom: 4 }}>Danger zone</div>
        <div className="text-dim" style={{ fontSize: 12 }}>
          Permanently delete this avatar and everything it learned. The mirrored Paperclip company stays
          intact — clean that up separately if you want.
        </div>
      </div>
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <button
          type="button"
          onClick={() => { setConfirmOpen(true); setTyped(""); }}
          style={{
            padding: "0.45rem 0.95rem", borderRadius: 6,
            background: "transparent", color: "var(--warning)",
            border: "1px solid var(--warning)", fontWeight: 600, fontSize: 12,
            cursor: "pointer",
          }}
        >
          Delete avatar
        </button>
      </div>

      {confirmOpen && (
        <div
          style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)",
            zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center",
            padding: "1.5rem",
          }}
          onClick={() => { if (!deleting) setConfirmOpen(false); }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "var(--surface)", border: "1px solid var(--warning)",
              borderRadius: 10, padding: "1.25rem 1.4rem", maxWidth: 460, width: "100%",
              display: "flex", flexDirection: "column", gap: "0.85rem",
            }}
          >
            <div style={{ fontSize: 16, fontWeight: 700, color: "var(--warning)" }}>Delete this avatar?</div>
            <div className="text-dim" style={{ fontSize: 13, lineHeight: 1.55 }}>
              This removes profile, voice, trust, tool meta, approvals, memory — everything. The change
              is immediate and cannot be undone.
            </div>
            <Field label="Type DELETE to confirm">
              <input
                type="text"
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                placeholder="DELETE"
                autoFocus
                style={inputStyle}
              />
            </Field>
            {error && <div style={{ color: "var(--warning)", fontSize: 12 }}>✗ {error}</div>}
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem" }}>
              <button
                type="button"
                onClick={() => setConfirmOpen(false)}
                disabled={deleting}
                style={ghostBtnStyle}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void confirmDelete()}
                disabled={typed !== "DELETE" || deleting}
                style={{
                  padding: "0.45rem 0.95rem", borderRadius: 6,
                  background: "var(--warning)", color: "var(--bg)", border: "none",
                  fontWeight: 600, fontSize: 12,
                  cursor: typed !== "DELETE" || deleting ? "default" : "pointer",
                  opacity: typed !== "DELETE" || deleting ? 0.5 : 1,
                }}
              >
                {deleting ? "Deleting…" : "Delete avatar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

// ── Shared atoms ───────────────────────────────────────────────────────

function Section({
  title, description, children, saveDisabled, saving, savedAt, error, onSave,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
  saveDisabled: boolean;
  saving: boolean;
  savedAt: string | null;
  error: string | null;
  onSave: () => void;
}) {
  return (
    <section style={card}>
      <div style={{ marginBottom: "0.75rem" }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text)", marginBottom: 4 }}>{title}</div>
        <div className="text-dim" style={{ fontSize: 12 }}>{description}</div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}>
        {children}
      </div>
      {error && <div style={{ color: "var(--warning)", fontSize: 12, marginTop: "0.6rem" }}>✗ {error}</div>}
      <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: "0.75rem", marginTop: "0.85rem" }}>
        {savedAt && !saving && <span className="text-dim" style={{ fontSize: 11 }}>Saved at {savedAt}</span>}
        <button
          type="button"
          onClick={onSave}
          disabled={saveDisabled}
          style={{
            padding: "0.45rem 0.95rem", borderRadius: 6,
            background: "var(--accent)", color: "var(--bg)", border: "none",
            fontWeight: 600, fontSize: 12,
            cursor: saveDisabled ? "default" : "pointer",
            opacity: saveDisabled ? 0.5 : 1,
          }}
        >
          {saving ? "Saving…" : "Save"}
        </button>
      </div>
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ fontSize: 11, fontWeight: 600, marginBottom: "0.3rem", color: "var(--text-dim)" }}>{label}</div>
      {children}
    </div>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return <div style={{ minHeight: "100vh", background: "var(--bg)" }}>{children}</div>;
}

const card: React.CSSProperties = {
  padding: "1rem 1.25rem",
  background: "var(--surface)",
  border: "1px solid var(--border)",
  borderRadius: 10,
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "0.45rem 0.65rem",
  background: "var(--bg)",
  border: "1px solid var(--border)",
  borderRadius: 6,
  color: "var(--text)",
  fontSize: 13,
  outline: "none",
};

const ghostBtnStyle: React.CSSProperties = {
  padding: "0.4rem 0.85rem",
  borderRadius: 6,
  background: "transparent",
  color: "var(--text-dim)",
  border: "1px solid var(--border)",
  fontSize: 12,
  cursor: "pointer",
};
