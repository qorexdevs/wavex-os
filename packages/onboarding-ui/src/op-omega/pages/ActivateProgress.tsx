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
import type { SwarmManifest } from "@op-omega/plugin-onboarding";
import { opOmegaOnboardingApi, ApiError } from "../lib/api";

type SlotStatus = "pending" | "hired" | "skipped" | "failed";

interface SlotRow {
  slot: string;
  status: SlotStatus;
  error?: string;
}

interface Props {
  companyId: string;
  swarmManifest: SwarmManifest;
}

const STAGGER_MS = 80;

function paperclipUiUrl(apiUrl: string | null): string {
  if (!apiUrl) return "#";
  return apiUrl.replace(/:3100\b/, ":5174");
}

export function ActivateProgress({ companyId, swarmManifest }: Props) {
  const navigate = useNavigate();
  const [rows, setRows] = useState<SlotRow[]>(() =>
    Object.keys(swarmManifest.agents).map((slot) => ({ slot, status: "pending" as const })),
  );
  const [error, setError] = useState<string | null>(null);
  const [paperclipUrl, setPaperclipUrl] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const ranRef = useRef(false);

  useEffect(() => {
    if (ranRef.current) return;
    ranRef.current = true;
    void (async () => {
      try {
        const r = await opOmegaOnboardingApi.activate(companyId);
        const createdSet = new Set(r.paperclipHandoff.created.map((c) => c.slot));
        const skippedSet = new Set(r.paperclipHandoff.skipped.map((s) => s.slot));
        const errorMap = new Map(r.paperclipHandoff.errors.map((e) => [e.slot, e.message]));
        setPaperclipUrl(r.paperclipHandoff.paperclipUrl);

        // Cosmetic stagger — flip each row sequentially so the operator
        // sees an animation rather than an instant green wall.
        const slots = Object.keys(swarmManifest.agents);
        for (let i = 0; i < slots.length; i++) {
          const slot = slots[i];
          await new Promise((res) => setTimeout(res, STAGGER_MS));
          setRows((prev) => prev.map((row) => {
            if (row.slot !== slot) return row;
            if (errorMap.has(slot)) return { ...row, status: "failed", error: errorMap.get(slot) };
            if (skippedSet.has(slot)) return { ...row, status: "skipped" };
            if (createdSet.has(slot) || !r.paperclipHandoff.enabled) return { ...row, status: "hired" };
            return { ...row, status: "hired" };
          }));
        }
        setDone(true);
      } catch (e) {
        setError(e instanceof ApiError ? e.message : (e as Error).message);
      }
    })();
  }, [companyId, swarmManifest]);

  function handleLaunch(): void {
    if (paperclipUrl) {
      window.open(paperclipUiUrl(paperclipUrl), "_blank", "noopener");
    }
    navigate(`/?companyId=${encodeURIComponent(companyId)}`);
  }

  const hiredCount = rows.filter((r) => r.status === "hired").length;
  const totalCount = rows.length;

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
            Hiring your team
          </div>
          <div className="text-dim" style={{ fontSize: 12 }}>
            {hiredCount} of {totalCount} {paperclipUrl ? "mirrored to Paperclip" : "activated"}
          </div>
        </div>

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
          {rows.map((r) => (
            <div
              key={r.slot}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.4rem",
                fontSize: 11,
                color: r.status === "pending" ? "var(--text-dim)" : "var(--text)",
              }}
              title={r.error}
            >
              <SlotIcon status={r.status} />
              <code style={{ fontSize: 10 }}>{r.slot}</code>
            </div>
          ))}
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

function SlotIcon({ status }: { status: SlotStatus }) {
  if (status === "pending") return <span style={{ color: "var(--text-dim)" }}>○</span>;
  if (status === "hired") return <span style={{ color: "var(--accent)" }}>✓</span>;
  if (status === "skipped") return <span style={{ color: "var(--text-dim)" }}>↷</span>;
  return <span style={{ color: "var(--warning)" }}>✗</span>;
}
