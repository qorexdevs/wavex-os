/** Polling helper for the wavex-local-ops daemon's health snapshot.
 *
 *  Source: GET /api/system/health (registered by wavex-os-server in
 *  Phase B). The route reads `~/.wavex-os/local-ops-state.json` and
 *  returns the snapshot verbatim — we never read the file from the
 *  browser. Contract is frozen; see SystemHealthChip for the rendering
 *  contract.
 *
 *  Empty-state shape (daemon hasn't run a cycle yet):
 *    { schema_version: 1, ran_at: 0, checks: null }
 *  The chip handles this as "initializing" — not a crash. */

import { useEffect, useRef, useState } from "react";

export type CheckStatus =
  | "ok" | "refreshed" | "refresh_failed" | "no_bundle"
  | "up_to_date" | "updated" | "dirty_tree" | "no_repo" | "fetch_failed"
  | "skipped" | "failed" | "some_dead";

export interface CheckEntry {
  status: CheckStatus;
  detail: string | null;
  // token
  expires_at?: number;
  user_id?: string;
  // git
  current_sha?: string;
  commits_pulled?: number;
  restart_needed?: string[];
  // install / build
  duration_ms?: number;
  packages_rebuilt?: string[];
  // processes
  mock_core?: string;
  wavex_os_server?: string;
  paperclip?: string;
  restarted?: string[];
}

export interface RequiresUserAction {
  reason: string;
  button_label: string;
  detail: string;
}

export interface SystemHealthSnapshot {
  schema_version: number;
  ran_at: number;
  ran_at_iso?: string;
  next_run_at?: number;
  cycle_duration_ms?: number;
  checks: {
    token: CheckEntry;
    git: CheckEntry;
    install: CheckEntry;
    build: CheckEntry;
    processes: CheckEntry;
  } | null;
  requires_user_action: RequiresUserAction | null;
}

/** Returned to the chip. `loading` is true only on the very first fetch;
 *  subsequent polls update `snapshot` in place. `error` is set when the
 *  fetch itself fails (network down, route 500). */
export interface UseSystemHealthResult {
  snapshot: SystemHealthSnapshot | null;
  loading: boolean;
  error: string | null;
  /** Triggers a manual cycle on the daemon, then bursts polls every 2s
   *  for 60s to catch the new state quickly. */
  runNow: () => Promise<void>;
}

const DEFAULT_INTERVAL_MS = 30_000;
const BURST_INTERVAL_MS = 2_000;
const BURST_DURATION_MS = 60_000;

export function useSystemHealth(): UseSystemHealthResult {
  const [snapshot, setSnapshot] = useState<SystemHealthSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const cancelledRef = useRef(false);
  const intervalRef = useRef<number | null>(null);
  const burstEndRef = useRef<number>(0);

  const fetchOnce = async () => {
    try {
      const r = await fetch("/api/system/health");
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const j = (await r.json()) as SystemHealthSnapshot;
      if (!cancelledRef.current) {
        setSnapshot(j);
        setError(null);
      }
    } catch (e) {
      if (!cancelledRef.current) {
        setError((e as Error).message || "fetch_failed");
      }
    } finally {
      if (!cancelledRef.current) setLoading(false);
    }
  };

  const schedule = (intervalMs: number) => {
    if (intervalRef.current !== null) {
      window.clearInterval(intervalRef.current);
    }
    intervalRef.current = window.setInterval(() => {
      void fetchOnce();
      // If burst window expired, fall back to default cadence.
      if (Date.now() > burstEndRef.current && intervalMs === BURST_INTERVAL_MS) {
        schedule(DEFAULT_INTERVAL_MS);
      }
    }, intervalMs);
  };

  useEffect(() => {
    cancelledRef.current = false;
    void fetchOnce();
    schedule(DEFAULT_INTERVAL_MS);
    return () => {
      cancelledRef.current = true;
      if (intervalRef.current !== null) window.clearInterval(intervalRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const runNow = async () => {
    try {
      await fetch("/api/system/health/run-now", { method: "POST" });
    } catch {
      // Best effort — the burst poll below will surface any change anyway.
    }
    burstEndRef.current = Date.now() + BURST_DURATION_MS;
    schedule(BURST_INTERVAL_MS);
    void fetchOnce();
  };

  return { snapshot, loading, error, runNow };
}

/** Top-level summary of the snapshot — drives the chip's color and label.
 *  - `healthy`     → all checks ok/up_to_date/skipped, no user action
 *  - `maintaining` → at least one check refreshed/updated/ok-after-failure,
 *                    within the last 5min, no errors, no user action
 *  - `needs_action`→ requires_user_action is non-null
 *  - `error`       → snapshot has a hard error somewhere (without user action)
 *  - `initializing`→ snapshot.checks is null (daemon hasn't run yet) */
export type OverallState = "healthy" | "maintaining" | "needs_action" | "error" | "initializing" | "offline";

export function deriveOverallState(snapshot: SystemHealthSnapshot | null, error: string | null): OverallState {
  if (error && !snapshot) return "offline";
  if (!snapshot) return "initializing";
  if (!snapshot.checks || snapshot.ran_at === 0) return "initializing";
  if (snapshot.requires_user_action) return "needs_action";
  const checks = Object.values(snapshot.checks);
  const hasHardError = checks.some((c) =>
    c.status === "refresh_failed" ||
    c.status === "failed" ||
    c.status === "fetch_failed" ||
    c.status === "some_dead" ||
    c.status === "dirty_tree" ||
    c.status === "no_repo" ||
    c.status === "no_bundle"
  );
  if (hasHardError) return "error";
  // Maintaining if anything was actively repaired in this cycle.
  const fiveMinAgoSec = Math.floor(Date.now() / 1000) - 5 * 60;
  const recentlyActive = snapshot.ran_at >= fiveMinAgoSec && checks.some((c) =>
    c.status === "refreshed" || c.status === "updated" ||
    (c.status === "ok" && (c.restarted?.length ?? 0) > 0) ||
    (c.packages_rebuilt?.length ?? 0) > 0
  );
  if (recentlyActive) return "maintaining";
  return "healthy";
}

/** Status → color token mapping for the per-check badges in the drawer. */
export function statusColor(status: CheckStatus): string {
  switch (status) {
    case "ok":
    case "up_to_date":
    case "refreshed":
    case "updated":
      return "var(--accent)";
    case "skipped":
      return "var(--text-dim)";
    case "refresh_failed":
    case "failed":
    case "fetch_failed":
    case "some_dead":
    case "dirty_tree":
    case "no_repo":
    case "no_bundle":
      return "var(--danger)";
    default:
      return "var(--warning)";
  }
}
