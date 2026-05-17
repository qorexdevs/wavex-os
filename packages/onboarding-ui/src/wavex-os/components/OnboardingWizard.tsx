/** 3-step onboarding wizard shell (WAVAAAA-48).
 *
 *  Renders as a full-screen overlay when is_new_user=true.
 *  Skipped entirely for returning users (is_new_user=false).
 *  Current step is persisted to the backend so a page refresh resumes
 *  at the correct step. */

import { useCallback, useEffect, useState } from "react";
import { userApi } from "../lib/api";

const TOTAL_STEPS = 3;

const STEPS = [
  {
    title: "Welcome to WaveX OS",
    body: "Your AI-powered company operating system. Let's get you set up in a few quick steps.",
  },
  {
    title: "Connect your workspace",
    body: "Configure your agents, connect your tools, and define how your AI fleet will operate.",
  },
  {
    title: "Launch your fleet",
    body: "Everything looks good. Your AI agents are ready to deploy — let's kick things off.",
  },
];

export function OnboardingWizard() {
  const [userId, setUserId] = useState<string | null>(null);
  const [step, setStep] = useState(1);
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    userApi.me()
      .then((res) => {
        if (res.user.isNewUser) {
          setUserId(res.user.id);
          setStep(Math.min(Math.max(res.user.wizardStep ?? 1, 1), TOTAL_STEPS));
          setVisible(true);
        }
      })
      .catch(() => {
        // /api/users/me unavailable (e.g. dev without mock-core) — skip wizard.
      })
      .finally(() => setLoading(false));
  }, []);

  const persist = useCallback(async (nextStep: number) => {
    if (!userId) return;
    setSaving(true);
    try {
      await userApi.setWizardStep(userId, nextStep);
      setStep(nextStep);
    } finally {
      setSaving(false);
    }
  }, [userId]);

  const handleNext = useCallback(async () => {
    if (step < TOTAL_STEPS) {
      await persist(step + 1);
    } else {
      if (!userId) return;
      setSaving(true);
      try {
        await userApi.completeWizard(userId);
        setVisible(false);
      } finally {
        setSaving(false);
      }
    }
  }, [step, userId, persist]);

  const handleBack = useCallback(async () => {
    if (step > 1) await persist(step - 1);
  }, [step, persist]);

  if (loading || !visible) return null;

  const progressPct = Math.round((step / TOTAL_STEPS) * 100);
  const current = STEPS[step - 1];

  return (
    <div style={{
      position: "fixed",
      inset: 0,
      background: "var(--bg)",
      zIndex: 1000,
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
    }}>
      {/* Top progress bar */}
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: "var(--border)" }}>
        <div style={{
          height: "100%",
          width: `${progressPct}%`,
          background: "var(--accent)",
          transition: "width 300ms ease",
        }} />
      </div>

      {/* Step dots */}
      <div style={{ position: "absolute", top: 20, display: "flex", gap: 8 }}>
        {Array.from({ length: TOTAL_STEPS }, (_, i) => (
          <div key={i} style={{
            width: 8,
            height: 8,
            borderRadius: "50%",
            background: i < step ? "var(--accent)" : "var(--border)",
            transition: "background 300ms",
          }} />
        ))}
      </div>

      {/* Step content */}
      <div style={{ maxWidth: 480, width: "100%", padding: "2rem", textAlign: "center" }}>
        <div style={{ fontSize: 12, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "0.5rem" }}>
          Step {step} of {TOTAL_STEPS}
        </div>
        <h1 style={{ fontSize: 28, marginBottom: "1rem", letterSpacing: "-0.02em" }}>
          {current.title}
        </h1>
        <p style={{ color: "var(--text-dim)", fontSize: 16, lineHeight: 1.6, marginBottom: "2.5rem" }}>
          {current.body}
        </p>
        <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
          {step > 1 && (
            <button className="secondary" onClick={handleBack} disabled={saving}>
              ← Back
            </button>
          )}
          <button onClick={handleNext} disabled={saving}>
            {saving ? "Saving…" : step === TOTAL_STEPS ? "Get started →" : "Next →"}
          </button>
        </div>
      </div>
    </div>
  );
}
