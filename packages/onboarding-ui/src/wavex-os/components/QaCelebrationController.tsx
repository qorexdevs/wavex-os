/** QaCelebrationController — mounts the QaCelebrationScreen once per user
 *  when their first smoke test has completed and is_new_user is still true.
 *
 *  Guard order:
 *    1. localStorage "wavex:qa_celebration_shown" — skips within the same
 *       browser session even before the API round-trip resolves.
 *    2. is_new_user from /api/users/me — the durable server-side guard that
 *       prevents the screen from ever showing again across sessions after
 *       QaCelebrationScreen calls PATCH /users/:id/complete-wizard.
 *    3. smoke_test_passed from /api/partner-checklist/:companyId — the
 *       trigger; polled every 5 s so the overlay appears without a reload. */

import { useEffect, useRef, useState } from "react";
import { useCompany } from "../lib/CompanyContext";
import { userApi } from "../lib/api";
import { QaCelebrationScreen } from "../pages/QaCelebrationScreen";

const CELEBRATION_LS_KEY = "wavex:qa_celebration_shown";

interface ChecklistPayload {
  ok: boolean;
  steps: {
    smoke_test_passed: boolean;
    ci_webhook_connected: boolean;
    app_count: number;
  };
}

interface SmokeTestRun {
  payload: {
    status: "pass" | "fail" | "error";
    tests_run?: number;
    tests_failed?: number;
    [key: string]: unknown;
  };
}

export function QaCelebrationController() {
  const { companyId } = useCompany();
  const [userId, setUserId] = useState<string | null>(null);
  const [testStatus, setTestStatus] = useState<"pass" | "fail" | "error">("pass");
  const [testsRun, setTestsRun] = useState<number | undefined>(undefined);
  const [testsFailed, setTestsFailed] = useState<number | undefined>(undefined);
  const [show, setShow] = useState(false);
  const resolvedRef = useRef(false);

  // Step 1 — fetch user identity + is_new_user guard.
  useEffect(() => {
    if (localStorage.getItem(CELEBRATION_LS_KEY)) return;
    userApi.me()
      .then((res) => {
        if (res.user.isNewUser) setUserId(res.user.id);
      })
      .catch(() => {});
  }, []);

  // Step 2 — poll checklist for smoke_test_passed when we have a userId + companyId.
  useEffect(() => {
    if (!userId || !companyId || resolvedRef.current) return;

    let cancelled = false;

    async function check(): Promise<void> {
      if (cancelled || resolvedRef.current) return;
      try {
        const r = await fetch(`/api/partner-checklist/${encodeURIComponent(companyId!)}`);
        if (!r.ok || cancelled) return;
        const data = (await r.json()) as ChecklistPayload;
        if (!data?.steps?.smoke_test_passed || cancelled) return;

        // Smoke test has passed — fetch the first run's details for summary.
        let status: "pass" | "fail" | "error" = "pass";
        let run: number | undefined;
        let failures: number | undefined;
        try {
          const tr = await fetch(`/api/smoke-test/${encodeURIComponent(companyId!)}`);
          if (tr.ok) {
            const { runs } = (await tr.json()) as { runs: SmokeTestRun[] };
            const first = runs[runs.length - 1]; // oldest (desc ordered — last element)
            if (first) {
              status = first.payload.status ?? "pass";
              if (first.payload.tests_run !== undefined) run = first.payload.tests_run;
              if (first.payload.tests_failed !== undefined) failures = first.payload.tests_failed;
            }
          }
        } catch { /* summary detail is best-effort */ }

        if (!cancelled) {
          resolvedRef.current = true;
          setTestStatus(status);
          setTestsRun(run);
          setTestsFailed(failures);
          setShow(true);
        }
      } catch { /* network error — retry on next interval */ }
    }

    void check();
    const id = window.setInterval(() => { void check(); }, 5_000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [userId, companyId]);

  if (!show || !userId) return null;

  return (
    <QaCelebrationScreen
      userId={userId}
      testStatus={testStatus}
      testsRun={testsRun}
      testsFailed={testsFailed}
      onDismiss={() => setShow(false)}
    />
  );
}
