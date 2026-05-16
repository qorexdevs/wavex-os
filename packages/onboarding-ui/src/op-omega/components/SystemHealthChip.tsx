/** SystemHealthChip — read-only surface for the wavex-local-ops daemon.
 *
 *  Renders a chip in the top bar mirroring HubTransparencyChip's visual
 *  language. Clicking expands a drawer with per-check rows + a "Run
 *  check now" button. NEVER surfaces terminal commands — actions are
 *  pre-wired buttons only.
 *
 *  Polls /api/system/health every 30s; bursts every 2s for 60s after a
 *  Run-now click. The daemon writes the underlying state file; we never
 *  read it directly from the browser.
 *
 *  Three top-level visual states:
 *  - healthy: grey ✓ "System healthy · main @<sha>"
 *  - maintaining: amber ⟳ "Updating…"
 *  - needs_action: red ! "Action required" + button bound to
 *    ACTION_REGISTRY[button_label].
 *
 *  If `requires_user_action.button_label` has no registry entry the
 *  button renders disabled with a tooltip explaining we don't have a
 *  wired action — never asks the customer to run a command.
 */

import { useState } from "react";
import {
  useSystemHealth,
  deriveOverallState,
  statusColor,
  type CheckEntry,
  type OverallState,
  type SystemHealthSnapshot,
} from "../lib/system-health";

/** Maps `requires_user_action.button_label` (verbatim from the daemon)
 *  to a clickable browser-side action. Unknown labels render disabled.
 *  Keep this small — the daemon is the source of truth for what state
 *  needs human intervention, the UI only knows how to react. */
const ACTION_REGISTRY: Record<string, () => void | Promise<void>> = {
  "Discard local changes": async () => {
    if (!window.confirm(
      "Discard all local changes in the wavex-os checkout?\n\n" +
      "This resets the working tree to match the latest pulled commit. " +
      "Anything you haven't committed will be lost.",
    )) return;
    try {
      const r = await fetch("/api/system/discard-local-changes", { method: "POST" });
      if (!r.ok) {
        window.alert(
          "Auto-fix not possible right now. The discard endpoint is unavailable — please contact support.",
        );
      }
    } catch {
      window.alert("Auto-fix not possible right now. Please contact support.");
    }
  },
  "Reconnect device": () => {
    window.location.href = "/os/link";
  },
  "Refresh page": () => {
    window.location.reload();
  },
};

const CHIP_BASE: React.CSSProperties = {
  fontSize: 10,
  padding: "0.1rem 0.45rem",
  borderRadius: 999,
  marginLeft: "0.25rem",
  cursor: "pointer",
  fontWeight: 500,
  whiteSpace: "nowrap",
  background: "transparent",
};

function chipColorFor(state: OverallState): { border: string; color: string; bg?: string } {
  switch (state) {
    case "healthy":      return { border: "var(--border)",  color: "var(--text-dim)" };
    case "maintaining":  return { border: "var(--warning)", color: "var(--warning)" };
    case "needs_action": return { border: "var(--danger)",  color: "var(--danger)", bg: "color-mix(in srgb, var(--danger) 8%, transparent)" };
    case "error":        return { border: "var(--danger)",  color: "var(--danger)" };
    case "offline":      return { border: "var(--border)",  color: "var(--text-dim)" };
    case "initializing": return { border: "var(--border)",  color: "var(--text-dim)" };
  }
}

function chipLabel(state: OverallState, snapshot: SystemHealthSnapshot | null): string {
  switch (state) {
    case "healthy": {
      const sha = snapshot?.checks?.git.current_sha?.slice(0, 7);
      return sha ? `✓ System healthy · main @${sha}` : "✓ System healthy";
    }
    case "maintaining":  return "⟳ Updating…";
    case "needs_action": return "! Action required";
    case "error":        return "! System check failed";
    case "offline":      return "○ Local ops unavailable";
    case "initializing": return "○ System health initializing…";
  }
}

function chipTitle(state: OverallState, snapshot: SystemHealthSnapshot | null, error: string | null): string {
  if (state === "offline") {
    return `Could not reach the local wavex-os server (${error ?? "fetch failed"}). It may still be starting up — this resolves itself within a few seconds.`;
  }
  if (state === "initializing") {
    return "The wavex-local-ops daemon hasn't completed its first cycle yet. This is normal right after install — should resolve within a few minutes.";
  }
  if (!snapshot) return "Loading system health…";
  const ranAt = snapshot.ran_at ? new Date(snapshot.ran_at * 1000).toLocaleTimeString() : "never";
  const nextAt = snapshot.next_run_at ? new Date(snapshot.next_run_at * 1000).toLocaleTimeString() : "unknown";
  const base = `Last successful cycle: ${ranAt} · Next run: ${nextAt}`;
  if (state === "maintaining") {
    const running = [];
    if (snapshot.checks?.token.status === "refreshed") running.push("refreshing token");
    if (snapshot.checks?.git.status === "updated") running.push("pulling latest");
    if ((snapshot.checks?.build.packages_rebuilt?.length ?? 0) > 0) running.push("rebuilding packages");
    if ((snapshot.checks?.processes.restarted?.length ?? 0) > 0) running.push("restarting processes");
    return `${base}\nIn progress: ${running.join(", ") || "self-healing"}`;
  }
  if (state === "needs_action" && snapshot.requires_user_action) {
    return `${base}\n${snapshot.requires_user_action.detail}`;
  }
  return base;
}

function checkSummary(name: string, c: CheckEntry): string {
  switch (name) {
    case "token":
      if (c.status === "ok" && c.expires_at) return `Token valid · expires ${new Date(c.expires_at * 1000).toLocaleTimeString()}`;
      if (c.status === "refreshed") return `Refreshed access token · expires ${c.expires_at ? new Date(c.expires_at * 1000).toLocaleTimeString() : "soon"}`;
      if (c.status === "refresh_failed") return "Could not refresh the device token";
      if (c.status === "no_bundle") return "This machine isn't paired yet";
      return c.status;
    case "git":
      if (c.status === "up_to_date") return `Up to date on \`${c.current_sha?.slice(0, 7) ?? "?"}\``;
      if (c.status === "updated") return `Pulled ${c.commits_pulled ?? "?"} commit(s) · now on \`${c.current_sha?.slice(0, 7) ?? "?"}\``;
      if (c.status === "dirty_tree") return "Local changes block update";
      if (c.status === "no_repo") return "Checkout not found";
      if (c.status === "fetch_failed") return "Could not reach git remote";
      return c.status;
    case "install":
      if (c.status === "skipped") return "No dependency changes detected";
      if (c.status === "ok") return `Dependencies installed${c.duration_ms ? ` · ${(c.duration_ms / 1000).toFixed(1)}s` : ""}`;
      if (c.status === "failed") return "Dependency install failed";
      return c.status;
    case "build":
      if (c.status === "skipped") return "No rebuild required";
      if (c.status === "ok") {
        const pkgs = c.packages_rebuilt ?? [];
        return pkgs.length === 0 ? "Build complete" : `Rebuilt ${pkgs.length} package(s): ${pkgs.join(", ")}`;
      }
      if (c.status === "failed") return "Build failed";
      return c.status;
    case "processes":
      if (c.status === "ok") {
        const restarted = c.restarted ?? [];
        return restarted.length > 0
          ? `Restarted ${restarted.join(", ")} · all processes alive`
          : "All processes alive";
      }
      if (c.status === "some_dead") return "One or more processes need restart";
      return c.status;
    default:
      return c.status;
  }
}

const CHECK_NAMES: Array<keyof NonNullable<SystemHealthSnapshot["checks"]>> = ["token", "git", "install", "build", "processes"];

export function SystemHealthChip() {
  const { snapshot, error, runNow } = useSystemHealth();
  const [open, setOpen] = useState(false);
  const [expandedDetail, setExpandedDetail] = useState<string | null>(null);
  const state = deriveOverallState(snapshot, error);
  const palette = chipColorFor(state);
  const action = snapshot?.requires_user_action;
  const wiredAction = action ? ACTION_REGISTRY[action.button_label] : undefined;

  return (
    <span style={{ position: "relative", display: "inline-flex", alignItems: "center", gap: "0.25rem" }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        title={chipTitle(state, snapshot, error)}
        style={{
          ...CHIP_BASE,
          border: `1px solid ${palette.border}`,
          color: palette.color,
          background: palette.bg ?? "transparent",
        }}
      >
        {chipLabel(state, snapshot)}
      </button>

      {state === "needs_action" && action && (
        <button
          type="button"
          onClick={() => { if (wiredAction) void wiredAction(); }}
          disabled={!wiredAction}
          title={wiredAction ? action.detail : `${action.detail}\n\nNo automatic action is wired for "${action.button_label}". Please contact support.`}
          style={{
            ...CHIP_BASE,
            border: `1px solid var(--danger)`,
            color: wiredAction ? "var(--bg)" : "var(--text-dim)",
            background: wiredAction ? "var(--danger)" : "transparent",
            cursor: wiredAction ? "pointer" : "not-allowed",
            fontWeight: 600,
          }}
        >
          {action.button_label}
        </button>
      )}

      {open && (
        <div
          role="dialog"
          aria-label="System health details"
          style={{
            position: "absolute",
            top: "calc(100% + 0.4rem)",
            left: 0,
            width: 360,
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius)",
            boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
            padding: "0.75rem",
            zIndex: 100,
            fontSize: 12,
            color: "var(--text)",
            whiteSpace: "normal",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
            <strong style={{ fontSize: 12 }}>System health</strong>
            <button
              type="button"
              onClick={() => void runNow()}
              style={{
                fontSize: 10, padding: "0.2rem 0.55rem",
                background: "var(--surface-2)", color: "var(--text)",
                border: "1px solid var(--border)", borderRadius: 6, cursor: "pointer",
              }}
            >
              Run check now
            </button>
          </div>

          {snapshot?.checks ? (
            <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: "0.4rem" }}>
              {CHECK_NAMES.map((name) => {
                const c = snapshot.checks![name];
                const color = statusColor(c.status);
                const hasDetail = !!c.detail;
                const isExpanded = expandedDetail === name;
                return (
                  <li
                    key={name}
                    style={{
                      display: "flex", flexDirection: "column",
                      padding: "0.4rem 0.5rem",
                      background: "var(--surface-2)",
                      border: "1px solid var(--border)",
                      borderRadius: 6,
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                      <span style={{
                        display: "inline-block", width: 8, height: 8, borderRadius: 999,
                        background: color, flexShrink: 0,
                      }} />
                      <span style={{ textTransform: "capitalize", fontWeight: 500, minWidth: 64 }}>{name}</span>
                      <span style={{ color: "var(--text-dim)", flex: 1, overflow: "hidden", textOverflow: "ellipsis" }}>
                        {checkSummary(name, c)}
                      </span>
                      {hasDetail && (
                        <button
                          type="button"
                          onClick={() => setExpandedDetail(isExpanded ? null : name)}
                          title={isExpanded ? "Hide detail" : "Show detail"}
                          style={{
                            fontSize: 10, padding: "0 0.35rem",
                            background: "transparent", color: "var(--text-dim)",
                            border: "1px solid var(--border)", borderRadius: 4, cursor: "pointer",
                          }}
                        >
                          ⓘ
                        </button>
                      )}
                    </div>
                    {isExpanded && hasDetail && (
                      <div style={{
                        marginTop: "0.4rem", fontSize: 11, color: "var(--text-dim)",
                        fontFamily: "ui-monospace, SFMono-Regular, monospace",
                        background: "var(--bg)", padding: "0.35rem 0.5rem",
                        borderRadius: 4, whiteSpace: "pre-wrap", wordBreak: "break-word",
                      }}>
                        {c.detail}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          ) : (
            <div style={{ color: "var(--text-dim)", padding: "0.5rem 0" }}>
              {state === "offline"
                ? "Local ops route is unreachable. Routine maintenance won't run until the local server is back."
                : "The local-ops daemon hasn't reported a cycle yet. Should appear within a few minutes of install."}
            </div>
          )}

          {snapshot?.ran_at_iso && (
            <div style={{ marginTop: "0.5rem", fontSize: 10, color: "var(--text-dim)" }}>
              Last run: {new Date(snapshot.ran_at_iso).toLocaleString()}
              {snapshot.next_run_at && ` · next: ${new Date(snapshot.next_run_at * 1000).toLocaleTimeString()}`}
            </div>
          )}

          {action && (
            <div style={{
              marginTop: "0.6rem", padding: "0.5rem",
              background: "color-mix(in srgb, var(--danger) 10%, transparent)",
              border: "1px solid var(--danger)", borderRadius: 6,
              color: "var(--text)", fontSize: 11,
            }}>
              <div style={{ fontWeight: 600, marginBottom: "0.25rem" }}>Action needed</div>
              <div style={{ color: "var(--text-dim)", marginBottom: "0.5rem" }}>{action.detail}</div>
              <button
                type="button"
                onClick={() => { if (wiredAction) void wiredAction(); }}
                disabled={!wiredAction}
                style={{
                  fontSize: 11, padding: "0.3rem 0.7rem",
                  background: wiredAction ? "var(--danger)" : "var(--surface-2)",
                  color: wiredAction ? "var(--bg)" : "var(--text-dim)",
                  border: "1px solid var(--danger)", borderRadius: 6,
                  cursor: wiredAction ? "pointer" : "not-allowed", fontWeight: 600,
                }}
              >
                {action.button_label}
              </button>
              {!wiredAction && (
                <div style={{ marginTop: "0.4rem", fontSize: 10, color: "var(--text-dim)" }}>
                  Auto-fix not possible: please contact support.
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </span>
  );
}
