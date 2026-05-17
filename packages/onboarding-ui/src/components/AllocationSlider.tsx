/** AllocationSlider — how much of the operator's Claude Max window the
 *  agent swarm may consume vs. what's reserved for Pool A onboarding
 *  inference.
 *
 *  Self-contained: fetches GET /api/inference-allocation on mount, PUTs
 *  on change (debounced 400ms so dragging doesn't spam the endpoint).
 *  Used in two places (per operator request 2026-05-14):
 *    - onboarding Pillar 2 — sets the default before the fleet exists
 *    - Mission Control     — live-adjustable once the fleet is running
 *
 *  Backend: packages/wavex-os-server/src/routes/inference-allocation.ts.
 *  The swarm_pct value scales every agent's heartbeat interval at hire
 *  time (paperclip-handoff heartbeatConfigForSlot) — lower swarm % →
 *  longer intervals → the fleet consumes less of the Max window. */
import { useEffect, useRef, useState } from "react";

interface Allocation {
  swarm_pct: number;
  pool_a_pct: number;
  updated_at: string;
}

interface Props {
  /** "wizard" = compact, fits inside a Pillar card.
   *  "console" = standalone card with its own heading. */
  variant?: "wizard" | "console";
}

const MIN_SWARM = 5;
const MAX_SWARM = 100;
const PERSIST_DEBOUNCE_MS = 400;

export function AllocationSlider({ variant = "console" }: Props) {
  const [swarmPct, setSwarmPct] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Initial load.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const r = await fetch("/api/inference-allocation");
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const a = (await r.json()) as Allocation;
        if (!cancelled) setSwarmPct(a.swarm_pct);
      } catch (e) {
        if (!cancelled) {
          // Degrade gracefully — show the default so the slider still works.
          setSwarmPct(70);
          setError(`Couldn't load saved allocation (${(e as Error).message}); showing default.`);
        }
      }
    })();
    return () => { cancelled = true; };
  }, []);

  function persist(next: number) {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setSaving(true);
      setError(null);
      try {
        const r = await fetch("/api/inference-allocation", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ swarm_pct: next }),
        });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const body = (await r.json()) as { updated_at?: string };
        setSavedAt(body.updated_at ?? new Date().toISOString());
      } catch (e) {
        setError(`Couldn't save: ${(e as Error).message}`);
      } finally {
        setSaving(false);
      }
    }, PERSIST_DEBOUNCE_MS);
  }

  if (swarmPct === null) {
    return (
      <div className="text-dim" style={{ fontSize: 12, padding: "0.5rem 0" }}>
        Loading inference allocation…
      </div>
    );
  }

  const poolAPct = 100 - swarmPct;

  const body = (
    <>
      <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>
        Claude Max allocation
      </div>
      <div className="text-dim" style={{ fontSize: 12, lineHeight: 1.5, marginBottom: 10 }}>
        Split your Claude Max window between the autonomous agent swarm and
        Pool A onboarding inference. A higher swarm share means agents wake
        more often and drive harder; Pool A's slice keeps onboarding snappy
        for new customers even when the fleet is busy.
      </div>

      <input
        type="range"
        min={MIN_SWARM}
        max={MAX_SWARM}
        step={5}
        value={swarmPct}
        data-testid="allocation-slider"
        onChange={(e) => {
          const next = Number(e.target.value);
          setSwarmPct(next);
          persist(next);
        }}
        style={{ width: "100%", accentColor: "var(--accent)", cursor: "pointer" }}
      />

      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6, fontSize: 12 }}>
        <span style={{ color: "var(--accent)", fontWeight: 600 }}>
          Swarm: {swarmPct}%
        </span>
        <span className="text-dim">
          Pool A onboarding: {poolAPct}%
        </span>
      </div>

      <div style={{ fontSize: 11, marginTop: 6, minHeight: 14 }}>
        {error
          ? <span style={{ color: "var(--warning)" }}>⚠ {error}</span>
          : saving
            ? <span className="text-dim">Saving…</span>
            : savedAt
              ? <span style={{ color: "var(--accent)" }}>✓ Saved</span>
              : <span className="text-dim">Drag to adjust — applies to the next fleet cycle.</span>}
      </div>
    </>
  );

  if (variant === "wizard") {
    // Compact — caller already provides a Card wrapper.
    return <div data-testid="allocation-slider-wizard">{body}</div>;
  }

  return (
    <div
      className="card"
      data-testid="allocation-slider-console"
      style={{ padding: "1rem 1.15rem", marginBottom: "1.5rem" }}
    >
      {body}
    </div>
  );
}
