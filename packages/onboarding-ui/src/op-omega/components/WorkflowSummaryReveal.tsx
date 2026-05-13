/** Animated wire-up panel shown during ImprintTheater's "Preparing your
 *  launch" wait. The workflow manifest lands within the first 30-60s
 *  (well before finalize completes), so we stagger-reveal one summary
 *  line per agent followed by a roll-up chip. The point is value
 *  perception: the operator watches the team get wired instead of
 *  staring at a spinner.
 *
 *  Read-only — owned by the caller passing in a manifest. */

import type { WorkflowManifest } from "@op-omega/plugin-onboarding";

interface Props {
  manifest: WorkflowManifest;
}

const STAGGER_MS = 80;
const MAX_TOTAL_MS = 3500;

export function WorkflowSummaryReveal({ manifest }: Props) {
  const agentEntries = Object.entries(manifest.agent_workflows);
  const bundleCount = Object.keys(manifest.bundle_workflows).length;
  const patchCount = manifest.t2_patches?.length ?? 0;

  // Cap the per-line stagger so 35 agents don't take 35*80=2.8s plus an
  // extra cliff on the summary chip. If we'd overrun MAX_TOTAL_MS, scale
  // the stagger down. The summary chip animation kicks off right after
  // the last line's animation starts.
  const stagger = Math.min(STAGGER_MS, Math.floor(MAX_TOTAL_MS / Math.max(1, agentEntries.length + 1)));
  const summaryDelay = stagger * agentEntries.length;

  return (
    <div style={{
      marginTop: "1.5rem",
      maxWidth: 520,
      width: "100%",
    }}>
      <style>{`
        @keyframes wavex-wf-fade-in {
          from { opacity: 0; transform: translateY(4px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
      <div className="text-dim" style={{ fontSize: 11, marginBottom: "0.5rem", textAlign: "center" }}>
        Building your team's playbook
      </div>
      <div style={{
        background: "#101015",
        border: "1px solid var(--border)",
        borderRadius: 6,
        padding: "0.6rem 0.75rem",
        maxHeight: 280,
        overflowY: "auto",
        fontSize: 11,
        lineHeight: 1.7,
      }}>
        {agentEntries.map(([slot, wf], i) => (
          <div
            key={slot}
            style={{
              opacity: 0,
              animation: `wavex-wf-fade-in 220ms ease-out forwards`,
              animationDelay: `${i * stagger}ms`,
              display: "flex",
              alignItems: "baseline",
              gap: "0.5rem",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            <code style={{ color: "var(--text)", fontSize: 10 }}>{slot}</code>
            <span className="text-dim" style={{ fontSize: 10 }}>·</span>
            <span style={{ color: "var(--accent)", fontSize: 10 }}>{wf.heartbeat}</span>
            <span className="text-dim" style={{ fontSize: 10 }}>·</span>
            <span className="text-dim" style={{ fontSize: 10 }}>
              {wf.on_fire.length} {wf.on_fire.length === 1 ? "task" : "tasks"}
            </span>
          </div>
        ))}
      </div>
      <div
        style={{
          opacity: 0,
          animation: `wavex-wf-fade-in 260ms ease-out forwards`,
          animationDelay: `${summaryDelay}ms`,
          marginTop: "0.6rem",
          textAlign: "center",
          fontSize: 11,
          color: "var(--text-dim)",
        }}
      >
        <span style={{ color: "var(--accent)" }}>{agentEntries.length}</span> routines
        {bundleCount > 0 && (
          <> · <span style={{ color: "var(--accent)" }}>{bundleCount}</span> bundle flows</>
        )}
        {patchCount > 0 && (
          <> · <span style={{ color: "var(--accent)" }}>{patchCount}</span> T2 patches</>
        )}
      </div>
    </div>
  );
}
