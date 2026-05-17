/** Step 4 of the Avatar branch (Phase 3) — Trust & boundaries. One screen
 *  that captures three things the runner uses on its first triage cycle:
 *
 *  1. Autonomy preset (cautious / balanced / aggressive)
 *  2. VIPs — emails or domains the avatar treats as always-now
 *  3. Privacy zones — labels/folders the avatar must never touch
 *  4. Notify-me chips — which events should ping the operator
 *
 *  All four are optional except the autonomy preset (defaults to
 *  Cautious — every draft holds for approval). Privacy zones prefill
 *  from the Gmail drawer if the operator already filled those there.
 */

import { useEffect, useState } from "react";
import { wavexOsOnboardingApi, ApiError } from "../../lib/api";
import { ChipInput, ChipMultiSelect, RadioGroup } from "../primitives";
import type { AvatarAutonomyPreset, AvatarTrust } from "../../state/onboarding-reducer";

interface Props {
  avatarId: string;
  onDone: (trust: AvatarTrust) => void;
}

type NotifyKey = "now_drafts" | "low_confidence" | "skill_paused" | "daily_digest";

const NOTIFY_OPTIONS: Array<{ value: NotifyKey; label: string }> = [
  { value: "now_drafts", label: "Now drafts ready" },
  { value: "low_confidence", label: "Confidence < 60%" },
  { value: "skill_paused", label: "Skill paused" },
  { value: "daily_digest", label: "Daily 8am digest" },
];

export function AvatarTrustCard({ avatarId, onDone }: Props) {
  const [preset, setPreset] = useState<AvatarAutonomyPreset>("cautious");
  const [vips, setVips] = useState<string[]>([]);
  const [privacyZones, setPrivacyZones] = useState<string[]>([]);
  const [notify, setNotify] = useState<NotifyKey[]>(["now_drafts"]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Prefill privacy zones from the Gmail drawer if the operator filled them
  // in Step 2. Best-effort; absent or empty → no prefill.
  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const r = await wavexOsOnboardingApi.getAvatar(avatarId);
        if (!alive) return;
        const gmailMeta = ((r as unknown as { tools_meta?: Record<string, { privacy_zones?: string[]; vips?: string[] }> }).tools_meta ?? {})["gmail"];
        if (gmailMeta?.privacy_zones && gmailMeta.privacy_zones.length > 0) {
          setPrivacyZones(gmailMeta.privacy_zones);
        }
        if (gmailMeta?.vips && gmailMeta.vips.length > 0) {
          setVips(gmailMeta.vips);
        }
      } catch { /* non-fatal */ }
    })();
    return () => { alive = false; };
  }, [avatarId]);

  async function submit(): Promise<void> {
    setSaving(true);
    setError(null);
    try {
      const trust: AvatarTrust = {
        autonomy_preset: preset,
        vips: vips.map((v) => ({ email: v })),
        privacy_zones: privacyZones,
        notify,
      };
      await wavexOsOnboardingApi.setAvatarTrust(avatarId, trust);
      onDone(trust);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : (e as Error).message);
      setSaving(false);
    }
  }

  return (
    <div style={{ marginTop: "0.5rem", display: "flex", flexDirection: "column", gap: "1rem" }}>
      <div className="text-dim" style={{ fontSize: 12 }}>
        How much autonomy to give your avatar on day one. You can graduate
        any skill later from the dashboard.
      </div>

      <div>
        <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-dim)", marginBottom: "0.4rem" }}>
          Autonomy preset
        </div>
        <RadioGroup<AvatarAutonomyPreset>
          value={preset}
          onChange={setPreset}
          options={[
            { value: "cautious", label: "Cautious", description: "Every draft waits for your approval. Recommended for the first week so you can see what I'm doing." },
            { value: "balanced", label: "Balanced", description: "I clear obvious FYI mail on my own when I'm very confident. Anything that needs a reply still waits for you." },
            { value: "aggressive", label: "Aggressive", description: "I send replies on your behalf when I'm mostly sure. You still review anything I'm unsure about." },
          ]}
        />
      </div>

      <div>
        <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-dim)", marginBottom: "0.4rem" }}>
          VIPs — emails or domains the avatar should always treat as Now
        </div>
        <ChipInput
          values={vips}
          onChange={setVips}
          placeholder="alex@bigfund.com, @stripe.com"
          ariaLabel="VIPs"
        />
      </div>

      <div>
        <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-dim)", marginBottom: "0.4rem" }}>
          Privacy zones — labels or folders the avatar must never touch
        </div>
        <ChipInput
          values={privacyZones}
          onChange={setPrivacyZones}
          placeholder="Personal, Family"
          ariaLabel="Privacy zones"
        />
      </div>

      <div>
        <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-dim)", marginBottom: "0.4rem" }}>
          Notify me when
        </div>
        <ChipMultiSelect<NotifyKey>
          values={notify}
          onChange={setNotify}
          options={NOTIFY_OPTIONS}
        />
      </div>

      {error && <div style={{ color: "var(--warning)", fontSize: 12 }}>✗ {error}</div>}

      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "0.25rem" }}>
        <button
          type="button"
          onClick={() => void submit()}
          disabled={saving}
          style={{
            padding: "0.45rem 0.95rem",
            borderRadius: 6,
            background: "var(--accent)",
            color: "var(--bg)",
            border: "none",
            fontWeight: 600,
            fontSize: 12,
            cursor: saving ? "wait" : "pointer",
            opacity: saving ? 0.6 : 1,
          }}
        >
          {saving ? "Saving…" : "Continue →"}
        </button>
      </div>
    </div>
  );
}
