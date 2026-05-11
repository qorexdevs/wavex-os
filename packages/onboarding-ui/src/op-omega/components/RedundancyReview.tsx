/** Redundancy review panel — surfaces exact-templateId duplicate groups
 *  in the swarm and lets the operator mute the redundant slots before
 *  the bridge writes them to DB. Renders nothing when no duplicates
 *  exist. Mounted between finalize and activate so mutes take effect on
 *  the next activate.
 *
 *  Three operator actions per group:
 *    - Mute slot   → adds to manifest.template_mutes; bridge skips it
 *    - Unmute      → removes from template_mutes
 *    - (Differentiate is handled out-of-band via the existing swap flow) */

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { opOmegaOnboardingApi, ApiError } from "../lib/api";

interface Props {
  companyId: string;
  /** Called whenever the operator mutates the manifest (mute/unmute) so
   *  the parent can refresh its own copy of finalize state if needed. */
  onChange?: () => void;
}

export function RedundancyReview({ companyId, onChange }: Props) {
  const qc = useQueryClient();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Groups collapse by default — operator opens the ones they want to act on.
  // Without this the panel can be 3000+ pixels tall and dominates the page,
  // pushing the Activate CTA below the fold.
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  function toggleExpand(templateId: string): void {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(templateId)) next.delete(templateId);
      else next.add(templateId);
      return next;
    });
  }

  const q = useQuery({
    queryKey: ["redundancy", companyId],
    queryFn: () => opOmegaOnboardingApi.getRedundancy(companyId),
    refetchOnWindowFocus: false,
  });

  async function toggleMute(slot: string, currentlyMuted: boolean): Promise<void> {
    setBusy(slot);
    setError(null);
    try {
      if (currentlyMuted) await opOmegaOnboardingApi.unmuteSlot(companyId, slot);
      else await opOmegaOnboardingApi.muteSlot(companyId, slot);
      await qc.invalidateQueries({ queryKey: ["redundancy", companyId] });
      onChange?.();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : (e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  if (q.isLoading) return null;
  if (q.isError) return null;
  const groups = q.data?.groups ?? [];
  if (groups.length === 0) {
    return (
      <div style={{
        padding: "0.75rem", background: "var(--bg)", border: "1px solid var(--border)",
        borderRadius: 4, fontSize: 12, color: "var(--text-dim)", marginTop: "1rem",
      }}>
        ✓ No duplicate templates detected — every slot resolves to a unique template.
      </div>
    );
  }

  // Build a set of currently-muted slots so toggle state is correct
  const mutedSet = new Set(q.data?.mutes ?? []);

  return (
    <div style={{
      padding: "0.75rem", background: "var(--bg)", border: "1px solid var(--warning)",
      borderRadius: 4, marginTop: "1rem",
    }}>
      <div style={{ fontSize: 13, fontWeight: 700, marginBottom: "0.4rem", color: "var(--warning)" }}>
        ⚠ Redundancy review · {groups.length} duplicate template group{groups.length === 1 ? "" : "s"}
      </div>
      <div className="text-dim" style={{ fontSize: 11, marginBottom: "0.75rem" }}>
        These slots all resolved to the same template. Mute the ones you don't need —
        the bridge will skip muted slots when writing agents. Re-activate to apply.
      </div>

      {groups.map((g) => {
        const parents = Object.entries(g.by_parent);
        const sameParentDup = parents.some(([, count]) => count > 1);
        const isOpen = expanded.has(g.template_id);
        const mutedInGroup = g.slots.filter((s) => mutedSet.has(s.slot)).length;
        // Compact one-line summary for the parent list, e.g. "3 under cfo"
        // or "1 under cpo, 1 under cmo" for cross-parent.
        const parentSummary = parents
          .map(([parent, count]) => `${count} under ${parent || "—"}`)
          .join(", ");
        return (
          <div key={g.template_id} style={{
            background: "var(--surface)", border: "1px solid var(--border)",
            borderRadius: 4, marginBottom: "0.4rem", fontSize: 12, overflow: "hidden",
          }}>
            <button
              type="button"
              onClick={() => toggleExpand(g.template_id)}
              aria-expanded={isOpen}
              style={{
                display: "flex", alignItems: "baseline", gap: "0.5rem",
                width: "100%", padding: "0.5rem 0.6rem",
                background: "transparent", border: "none",
                color: "var(--text)", textAlign: "left", cursor: "pointer",
                fontFamily: "inherit", fontSize: 12,
              }}
            >
              <span style={{ fontSize: 10, color: "var(--text-dim)", width: 12 }}>
                {isOpen ? "▼" : "▶"}
              </span>
              <code style={{ fontWeight: 600 }}>{g.template_id}</code>
              <span className="text-dim" style={{ fontSize: 11 }}>
                · {g.slots.length} slots ({parentSummary})
                {sameParentDup && " · same-parent"}
                {mutedInGroup > 0 && ` · ${mutedInGroup} muted`}
              </span>
              <span style={{ marginLeft: "auto", fontSize: 10, color: "var(--text-dim)" }}>
                weight {g.weight}
              </span>
            </button>
            {isOpen && (
              <div style={{ padding: "0 0.6rem 0.5rem 1.7rem", borderTop: "1px solid var(--border)" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11, fontFamily: "monospace", marginTop: "0.4rem" }}>
                  <thead>
                    <tr style={{ color: "var(--text-dim)", fontSize: 10 }}>
                      <th style={{ textAlign: "left", padding: "2px 6px 2px 0" }}>slot</th>
                      <th style={{ textAlign: "left", padding: "2px 6px" }}>parent</th>
                      <th style={{ textAlign: "left", padding: "2px 6px" }}>origin</th>
                      <th style={{ textAlign: "right", padding: "2px 0 2px 6px" }}>action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {g.slots.map((s) => {
                      const isMuted = mutedSet.has(s.slot);
                      return (
                        <tr key={s.slot}>
                          <td style={{ padding: "3px 6px 3px 0", textDecoration: isMuted ? "line-through" : "none", color: isMuted ? "var(--text-dim)" : "var(--text)" }}>
                            {s.slot}
                          </td>
                          <td style={{ padding: "3px 6px", color: "var(--text-dim)" }}>{s.parent_slot || "—"}</td>
                          <td style={{ padding: "3px 6px", color: "var(--text-dim)" }}>{s.origin}</td>
                          <td style={{ padding: "3px 0 3px 6px", textAlign: "right" }}>
                            <button
                              type="button"
                              className="secondary"
                              onClick={() => void toggleMute(s.slot, isMuted)}
                              disabled={busy !== null}
                              style={{ fontSize: 10, padding: "2px 8px" }}
                            >
                              {busy === s.slot ? "…" : isMuted ? "Unmute" : "Mute"}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        );
      })}

      {error && (
        <div style={{ marginTop: "0.4rem", fontSize: 11, color: "var(--warning)" }}>
          ✗ {error}
        </div>
      )}
    </div>
  );
}
