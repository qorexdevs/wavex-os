/** Design-partner onboarding checklist.
 *
 *  Shows 3 activation milestones in the dashboard sidebar.
 *  Polls /api/partner-checklist/:companyId every 5 s so steps auto-check
 *  as the corresponding events fire — no page reload required.
 *
 *  When all 3 steps complete, fires POST /api/partner-signals/emit once
 *  to record the partner_activation_complete event and send the Telegram
 *  upsell alert. The fired flag is kept in a ref so it survives re-renders
 *  without bouncing on the server (idempotent from the UI side). */

import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useCompany } from "../../wavex-os/lib/CompanyContext";
import { getSupabase } from "../../lib/supabase";

interface ChecklistPayload {
  ok: boolean;
  companyId: string;
  steps: {
    smoke_test_passed: boolean;
    ci_webhook_connected: boolean;
    app_count: number;
  };
  all_complete: boolean;
}

interface ManifestPayload {
  ok: boolean;
  manifest?: { company?: { name?: string } };
}

async function emitActivationComplete(companyId: string, companyName: string, appCount: number) {
  await fetch("/api/partner-signals/emit", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      companyId,
      partner_id: companyId,
      partner_name: companyName || companyId,
      app_count: appCount,
    }),
  }).catch(() => {
    // best-effort: server may not have Supabase/Telegram configured
  });
}

function Step({ label, done }: { label: string; done: boolean }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "0.6rem",
        padding: "0.45rem 0",
        borderBottom: "1px solid var(--border)",
      }}
    >
      <div
        style={{
          width: 20,
          height: 20,
          borderRadius: "50%",
          flexShrink: 0,
          border: done ? "none" : "2px solid var(--border)",
          background: done ? "var(--accent)" : "transparent",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          transition: "background 200ms, border-color 200ms",
        }}
      >
        {done && (
          <svg width="11" height="9" viewBox="0 0 11 9" fill="none">
            <path d="M1 4.5L4 7.5L10 1.5" stroke="#08221d" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </div>
      <span
        style={{
          fontSize: 13,
          color: done ? "var(--text)" : "var(--text-dim)",
          textDecoration: done ? "none" : "none",
          transition: "color 200ms",
        }}
      >
        {label}
      </span>
    </div>
  );
}

const FIRST_TEST_STORAGE_KEY = "wavex:first_test_fired";

function fireFirstTestResult(userId: string): void {
  fetch("/api/wizard-events", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      userId,
      eventType: "first_test_result",
      status: "pass",
      ts: new Date().toISOString(),
    }),
  }).catch(() => {});
}

export function OnboardingChecklist() {
  const { companyId } = useCompany();
  const activationFiredRef = useRef(false);
  const firstTestFiredRef = useRef(false);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    getSupabase()?.auth.getSession().then(({ data }) => {
      if (data.session?.user.id) setUserId(data.session.user.id);
    }).catch(() => {});
  }, []);

  const checklistQ = useQuery<ChecklistPayload>({
    enabled: !!companyId,
    queryKey: ["partner-checklist", companyId],
    queryFn: async () => {
      const r = await fetch(`/api/partner-checklist/${encodeURIComponent(companyId!)}`);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.json();
    },
    refetchInterval: 5_000,
  });

  const manifestQ = useQuery<ManifestPayload>({
    enabled: !!companyId,
    queryKey: ["instance-manifest", companyId],
    queryFn: async () => {
      const r = await fetch(`/api/instance/${encodeURIComponent(companyId!)}/manifest`);
      if (r.status === 404) return { ok: false };
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.json();
    },
    staleTime: 60_000,
  });

  const data = checklistQ.data;
  const companyName = manifestQ.data?.manifest?.company?.name ?? "";

  useEffect(() => {
    if (!data?.all_complete || !companyId || activationFiredRef.current) return;
    activationFiredRef.current = true;
    void emitActivationComplete(companyId, companyName, data.steps.app_count);
  }, [data?.all_complete, companyId, companyName, data?.steps.app_count]);

  // Fire first_test_result once per user when smoke_test_passed flips true.
  useEffect(() => {
    if (!data?.steps.smoke_test_passed || !userId || firstTestFiredRef.current) return;
    if (localStorage.getItem(FIRST_TEST_STORAGE_KEY)) return;
    firstTestFiredRef.current = true;
    localStorage.setItem(FIRST_TEST_STORAGE_KEY, "1");
    fireFirstTestResult(userId);
  }, [data?.steps.smoke_test_passed, userId]);

  if (!companyId) return null;

  const steps = data?.steps;
  const allDone = data?.all_complete ?? false;
  const loading = checklistQ.isLoading;

  return (
    <div
      className="card"
      style={{ padding: "1rem 1.1rem" }}
    >
      <div
        style={{
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: "0.04em",
          textTransform: "uppercase",
          color: allDone ? "var(--accent)" : "var(--text-dim)",
          marginBottom: "0.7rem",
        }}
      >
        {allDone ? "Activation complete ✓" : "Activation checklist"}
      </div>

      {loading ? (
        <div className="text-dim" style={{ fontSize: 12 }}>Checking…</div>
      ) : (
        <>
          <Step
            label="First smoke test passed"
            done={steps?.smoke_test_passed ?? false}
          />
          <Step
            label="CI integration live"
            done={steps?.ci_webhook_connected ?? false}
          />
          <div style={{ borderBottom: "none" }}>
            <Step
              label={`2nd app connected${!steps?.smoke_test_passed || !steps?.ci_webhook_connected ? ` (${steps?.app_count ?? 0}/2)` : ""}`}
              done={(steps?.app_count ?? 0) >= 2}
            />
          </div>
        </>
      )}

      {allDone && (
        <div
          style={{
            marginTop: "0.7rem",
            fontSize: 11,
            color: "var(--accent)",
            lineHeight: 1.5,
          }}
        >
          Partner activation event recorded.
        </div>
      )}
    </div>
  );
}
