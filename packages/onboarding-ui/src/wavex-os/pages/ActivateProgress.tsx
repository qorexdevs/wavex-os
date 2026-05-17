/** Activate Progress — shown after the operator picks a tier (or skips)
 *  in the pricing dialog. Fires POST /api/instance/:id/activate, then
 *  shows a slot-by-slot hire animation. On completion, opens the
 *  Paperclip dashboard in a new tab and navigates this tab to Mission
 *  Control.
 *
 *  The activate route returns the full handoff report in one shot, so the
 *  per-slot flips here are cosmetic (200ms stagger). v2 can wire a real
 *  polling endpoint against paperclip-handoff.json. */

import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { SwarmManifest } from "@wavex-os/plugin-onboarding";
import { wavexOsOnboardingApi, ApiError } from "../lib/api";

type SlotStatus = "pending" | "hiring" | "hired" | "already_mapped" | "skipped" | "failed";
type SwarmStatus = "active" | "standby" | "parked" | "disabled" | "pending";

interface SlotRow {
  slot: string;
  status: SlotStatus;
  /** Status from the wavex swarm manifest — distinguishes operator-active
   *  agents from the ones parked by the sub-fleet scope filter (or by the
   *  swarm generator's own demote logic). All slots get mirrored to Paperclip
   *  regardless, but the activate screen should reflect what's actually
   *  running on the wavex side. */
  swarmStatus: SwarmStatus;
  reason?: string;
  error?: string;
}

interface GlobalError {
  slot: string;
  message: string;
}

interface Props {
  companyId: string;
  swarmManifest: SwarmManifest;
}

const POLL_MS = 500;

function paperclipUiUrl(apiUrl: string | null): string {
  if (!apiUrl) return "#";
  return apiUrl.replace(/:3100\b/, ":5174");
}

export function ActivateProgress({ companyId, swarmManifest }: Props) {
  const navigate = useNavigate();
  const [rows, setRows] = useState<SlotRow[]>(() =>
    Object.entries(swarmManifest.agents).map(([slot, agent]) => ({
      slot,
      status: "pending" as const,
      swarmStatus: ((agent as { status?: string }).status ?? "pending") as SwarmStatus,
    })),
  );
  const [error, setError] = useState<string | null>(null);
  const [globalErrors, setGlobalErrors] = useState<GlobalError[]>([]);
  const [paperclipUrl, setPaperclipUrl] = useState<string | null>(null);
  const [handoffEnabled, setHandoffEnabled] = useState<boolean>(true);
  const [done, setDone] = useState(false);
  const ranRef = useRef(false);

  useEffect(() => {
    if (ranRef.current) return;
    ranRef.current = true;
    let stillPolling = true;

    // Poll handoff-progress.json every 500ms while activate is in flight.
    // The bridge writes per-slot status as it hires each agent, so the
    // UI paints real progression instead of waiting for the single-shot
    // POST response.
    void (async () => {
      while (stillPolling) {
        try {
          const r = await wavexOsOnboardingApi.getHandoffStatus(companyId);
          if (r.progress) {
            if (r.progress.paperclipUrl) setPaperclipUrl(r.progress.paperclipUrl);
            const progressMap = new Map(r.progress.slots.map((s) => [s.slot, s.status as SlotStatus]));
            // Functional update: keep swarmStatus (set from manifest at
            // mount), only update the Paperclip mirror status.
            setRows((prev) => prev.map((row) => ({
              ...row,
              status: progressMap.get(row.slot) ?? row.status,
            })));
          }
        } catch { /* polling error — silent retry */ }
        await new Promise((res) => setTimeout(res, POLL_MS));
      }
    })();

    void (async () => {
      try {
        const r = await wavexOsOnboardingApi.activate(companyId);
        const createdSet = new Set(r.paperclipHandoff.created.map((c) => c.slot));
        // Split skipped into already-mapped (success — agents are live in
        // Paperclip from a prior activate) vs muted-by-operator + other.
        // The reason field distinguishes them.
        const alreadyMappedSet = new Set<string>();
        const otherSkippedMap = new Map<string, string>();
        for (const s of r.paperclipHandoff.skipped) {
          if (s.reason === "already-mapped") alreadyMappedSet.add(s.slot);
          else otherSkippedMap.set(s.slot, s.reason);
        }
        // Errors. Bootstrap errors (slot="<bootstrap>") are global — they
        // don't match any real row, so surface separately.
        const errorMap = new Map<string, string>();
        const globals: GlobalError[] = [];
        for (const e of r.paperclipHandoff.errors) {
          if (e.slot === "<bootstrap>" || !rows.some((row) => row.slot === e.slot)) {
            globals.push({ slot: e.slot, message: e.message });
          } else {
            errorMap.set(e.slot, e.message);
          }
        }
        setGlobalErrors(globals);
        setHandoffEnabled(r.paperclipHandoff.enabled);
        if (r.paperclipHandoff.paperclipUrl) setPaperclipUrl(r.paperclipHandoff.paperclipUrl);

        // Activate returned. Stop polling + reconcile against the final
        // report so any in-flight rows flip to their terminal state.
        stillPolling = false;
        setRows((prev) => prev.map((row) => {
          if (errorMap.has(row.slot)) return { ...row, status: "failed", error: errorMap.get(row.slot) };
          if (alreadyMappedSet.has(row.slot)) return { ...row, status: "already_mapped", reason: "already-mapped" };
          if (otherSkippedMap.has(row.slot)) return { ...row, status: "skipped", reason: otherSkippedMap.get(row.slot) };
          if (createdSet.has(row.slot) || !r.paperclipHandoff.enabled) return { ...row, status: "hired" };
          return row;
        }));
        setDone(true);
      } catch (e) {
        stillPolling = false;
        setError(e instanceof ApiError ? e.message : (e as Error).message);
      }
    })();

    return () => { stillPolling = false; };
  }, [companyId, swarmManifest]);

  function handleLaunch(): void {
    if (paperclipUrl) {
      window.open(paperclipUiUrl(paperclipUrl), "_blank", "noopener");
    }
    navigate(`/?companyId=${encodeURIComponent(companyId)}`);
  }

  // "Mirrored" = anything that successfully landed in Paperclip for this
  // company. Counts hired (just created) + already_mapped (created in a
  // prior activate, still live in Paperclip). Excludes failed + pending.
  const mirroredCount = rows.filter((r) => r.status === "hired" || r.status === "already_mapped").length;
  const failedCount = rows.filter((r) => r.status === "failed").length;
  const totalCount = rows.length;
  const alreadyMappedAll = done && handoffEnabled && rows.every((r) => r.status === "already_mapped");

  // Three buckets that need separate counts so the operator sees why
  // "mirrored to Paperclip" can be larger than "active on wavex":
  //   * activeOnWavex   — running locally (swarm status active/standby)
  //   * parkedInScope   — vendor-parked but department IS in operator scope,
  //                       so the bridge mirrored them to Paperclip too
  //   * outOfScope      — department is outside the focused scope, skipped
  //                       by the bridge entirely
  //
  // "Mirrored to Paperclip" = activeOnWavex + parkedInScope; outOfScope
  // never lands in Paperclip. Surfacing this as one labeled line collapses
  // the apparent contradiction the operator saw (9 active vs 12 mirrored).
  const activeOnWavex = rows.filter((r) => r.swarmStatus === "active" || r.swarmStatus === "standby").length;
  const parkedOnWavex = rows.filter((r) => r.swarmStatus === "parked" || r.swarmStatus === "disabled").length;
  const outOfScope = rows.filter((r) => r.status === "skipped" && r.reason === "outside-scope").length;
  const parkedInScope = Math.max(0, parkedOnWavex - outOfScope);
  const hasFocusedScope = outOfScope > 0 || parkedInScope > 0;

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 90,
      background: "#0a0a0c",
      display: "flex", flexDirection: "column", alignItems: "center", padding: "2rem",
      overflowY: "auto",
    }}>
      <div style={{ maxWidth: 640, width: "100%", display: "flex", flexDirection: "column", gap: "1.25rem", margin: "auto 0" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 18, fontWeight: 700, marginBottom: "0.35rem" }}>
            {alreadyMappedAll ? "Already activated" : failedCount > 0 ? "Activation issues" : "Hiring your team"}
          </div>
          <div className="text-dim" style={{ fontSize: 12, lineHeight: 1.55 }}>
            {/* Line 1: wavex swarm breakdown. In focused scope this is three
             *  numbers — what the operator runs locally vs what was carved
             *  off — and the gap explains the higher Paperclip mirror count
             *  on line 2. */}
            <span style={{ color: "var(--accent)" }}>{activeOnWavex} active</span>
            {hasFocusedScope && parkedInScope > 0 && (
              <>
                {" · "}
                <span>{parkedInScope} parked</span>
              </>
            )}
            {hasFocusedScope && outOfScope > 0 && (
              <>
                {" · "}
                <span>{outOfScope} out of scope</span>
              </>
            )}
            {failedCount > 0 && (
              <>
                {" · "}
                <span style={{ color: "var(--warning)" }}>{failedCount} failed</span>
              </>
            )}
          </div>
          {/* Line 2: Paperclip mirror count on its own line so the two
           *  denominators (35 swarm slots vs 12 mirrored agents) don't
           *  visually collide. */}
          {paperclipUrl && (
            <div className="text-dim" style={{ fontSize: 11, marginTop: "0.2rem", opacity: 0.85 }}>
              {mirroredCount} mirrored to Paperclip
              {hasFocusedScope && <> · {outOfScope} skipped (outside scope)</>}
            </div>
          )}
          {alreadyMappedAll && (
            <div className="text-dim" style={{ fontSize: 11, marginTop: "0.25rem", opacity: 0.7 }}>
              Already live in Paperclip from a prior activate
            </div>
          )}
        </div>

        {/* Surface global handoff errors (e.g. <bootstrap> from the
         *  activate-route catch handler when handoffToPaperclip throws). */}
        {globalErrors.length > 0 && (
          <div style={{
            background: "color-mix(in srgb, var(--warning) 14%, transparent)",
            border: "1px solid var(--warning)",
            borderRadius: 6,
            padding: "0.6rem 0.75rem",
            fontSize: 11,
            color: "var(--warning)",
          }}>
            <div style={{ fontWeight: 700, marginBottom: "0.25rem" }}>
              ✗ Paperclip handoff failed
            </div>
            {globalErrors.map((e, i) => (
              <div key={i} style={{ marginTop: i > 0 ? "0.3rem" : 0, color: "var(--text)", opacity: 0.85 }}>
                {e.message}
              </div>
            ))}
            <div style={{ marginTop: "0.35rem", color: "var(--text-dim)", fontSize: 10 }}>
              Your manifest is signed + agents are in the wavex DB. Mission
              Control will work. Restart Paperclip on :3100 and re-activate
              when ready.
            </div>
          </div>
        )}

        <div style={{
          background: "#13131a",
          border: "1px solid var(--border)",
          borderRadius: 8,
          padding: "0.75rem",
          maxHeight: "50vh",
          overflowY: "auto",
          display: "grid",
          gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
          gap: "0.35rem 0.85rem",
        }}>
          {rows.map((r) => {
            const isParked = r.swarmStatus === "parked" || r.swarmStatus === "disabled";
            return (
            <div
              key={r.slot}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.4rem",
                fontSize: 11,
                color: r.status === "pending" ? "var(--text-dim)" : "var(--text)",
                opacity: isParked ? 0.45 : 1,
              }}
              title={isParked ? `${r.slot} — parked (outside scope or auto-demoted)` : r.error}
            >
              <SlotIcon status={r.status} swarmStatus={r.swarmStatus} />
              <code style={{ fontSize: 10 }}>{r.slot}</code>
              {isParked && <span style={{ fontSize: 9, color: "var(--text-dim)", marginLeft: "auto" }}>parked</span>}
            </div>
            );
          })}
        </div>

        {error && (
          <div style={{ color: "var(--warning)", fontSize: 12, textAlign: "center" }}>
            ✗ {error}
          </div>
        )}

        <button
          type="button"
          onClick={handleLaunch}
          disabled={!done}
          style={{
            padding: "0.7rem 1.4rem",
            borderRadius: 8,
            background: "var(--accent)",
            color: "var(--bg)",
            border: "none",
            fontWeight: 700,
            fontSize: 14,
            cursor: done ? "pointer" : "wait",
            opacity: done ? 1 : 0.5,
            alignSelf: "center",
          }}
        >
          {done ? "Open Mission Control →" : "Hiring…"}
        </button>
      </div>
    </div>
  );
}

function SlotIcon({ status, swarmStatus }: { status: SlotStatus; swarmStatus?: SwarmStatus }) {
  // Parked / disabled on wavex side → ↷ regardless of mirror status.
  // Paperclip got the agent but it won't run on the operator's swarm
  // until they unpark it from Mission Control.
  if (swarmStatus === "parked" || swarmStatus === "disabled") {
    return <span style={{ color: "var(--text-dim)" }}>↷</span>;
  }
  if (status === "pending") return <span style={{ color: "var(--text-dim)" }}>○</span>;
  if (status === "hiring") return <span className="wavex-pulse-dot" style={{ color: "var(--warning)" }}>●</span>;
  if (status === "hired") return <span style={{ color: "var(--accent)" }}>✓</span>;
  // Already-mapped from a prior activate → still live in Paperclip → render
  // as success but with a subtle ↻ overlay so the operator can see it
  // wasn't freshly created in this activate.
  if (status === "already_mapped") return <span style={{ color: "var(--accent)", opacity: 0.7 }}>✓</span>;
  if (status === "skipped") return <span style={{ color: "var(--text-dim)" }}>↷</span>;
  return <span style={{ color: "var(--warning)" }}>✗</span>;
}
