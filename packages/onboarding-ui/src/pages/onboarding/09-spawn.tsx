import { useEffect, useRef, useState } from "react";
import { NavButtons } from "../../components/NavButtons";
import { useOnboarding } from "../../store";
import { DEFAULT_ORG, TEMPLATES_BY_ID } from "../../data/templates";

interface SpawnEvent {
  ts: number;
  level: "info" | "ok" | "warn" | "error";
  message: string;
  agentId?: string;
}

type SpawnStatus = "idle" | "running" | "succeeded" | "failed";

export default function Spawn() {
  const { goalKpiId } = useOnboarding();
  const [events, setEvents] = useState<SpawnEvent[]>([]);
  const [status, setStatus] = useState<SpawnStatus>("idle");
  const [runId, setRunId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const logRef = useRef<HTMLPreElement>(null);

  // auto-scroll the log
  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [events]);

  async function startSpawn() {
    setEvents([]);
    setRunId(null);
    setError(null);
    setStatus("running");

    // Build the spawn payload from the default org + the user's primary goal
    const agents = DEFAULT_ORG.map((node) => {
      const tpl = TEMPLATES_BY_ID[node.templateId];
      const ownedKpiIds = [...(tpl?.defaultKpis ?? [])];
      // CEO owns the primary goal
      if (node.slot === "ceo" && goalKpiId && !ownedKpiIds.includes(goalKpiId)) {
        ownedKpiIds.unshift(goalKpiId);
      }
      return {
        slot: node.slot,
        templateId: node.templateId,
        reportsToSlot: node.reportsToSlot,
        ownedKpiIds,
      };
    });

    let id: string;
    try {
      const resp = await fetch("/api/paperclip/spawn", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agents }),
      });
      if (!resp.ok) throw new Error(`spawn POST ${resp.status}: ${await resp.text()}`);
      const json = await resp.json();
      id = json.runId;
      setRunId(id);
    } catch (e) {
      setError(
        `Failed to start spawn: ${(e as Error).message}. Is the mock-core server running on :3101? Run "pnpm dev:full" or "pnpm --filter @wavex-os/mock-core dev" in another terminal.`,
      );
      setStatus("failed");
      return;
    }

    // Subscribe to SSE
    const es = new EventSource(`/api/paperclip/spawn/${id}/events`);
    es.addEventListener("progress", (e) => {
      try {
        const ev = JSON.parse((e as MessageEvent).data) as SpawnEvent;
        setEvents((prev) => [...prev, ev]);
      } catch {
        // ignore malformed events
      }
    });
    es.addEventListener("done", (e) => {
      try {
        const data = JSON.parse((e as MessageEvent).data) as { status: SpawnStatus };
        setStatus(data.status);
      } catch {
        setStatus("succeeded");
      }
      es.close();
    });
    es.onerror = () => {
      setError("SSE connection lost. The spawn may still be running — check /api/runs/<runId> for status.");
      es.close();
    };
  }

  return (
    <>
      <h1>Spawning your company</h1>
      <p className="text-dim" style={{ fontSize: 16, marginBottom: "1.5rem" }}>
        {status === "idle"
          ? "Ready to spawn. Click below to materialize your agents on the local core."
          : status === "running"
            ? "Spawning live — watch the feed below."
            : status === "succeeded"
              ? "All agents ready. Continue to OAuth handoff."
              : "Spawn failed — see the error below."}
      </p>

      {status === "idle" && (
        <button onClick={startSpawn} style={{ marginBottom: "1rem" }}>Spawn my company →</button>
      )}

      {error && (
        <div className="card" style={{ borderColor: "var(--warning)", color: "var(--warning)" }}>
          {error}
        </div>
      )}

      {(events.length > 0 || status === "running") && (
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          <div style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "0.5rem 1rem",
            borderBottom: "1px solid var(--border)",
            background: "var(--surface-2)",
            fontSize: 12,
          }}>
            <span className="text-dim">runId: <code>{runId ?? "—"}</code></span>
            <span style={{
              color: status === "succeeded" ? "var(--accent)" : status === "failed" ? "var(--warning)" : "var(--text-dim)",
              fontWeight: 600,
            }}>
              {status === "running" && <span style={{ marginRight: 6 }}>●</span>}
              {status.toUpperCase()}
            </span>
          </div>
          <pre
            ref={logRef}
            style={{
              margin: 0,
              padding: "1rem",
              fontSize: 12,
              fontFamily: "ui-monospace, SFMono-Regular, monospace",
              maxHeight: 400,
              overflowY: "auto",
              lineHeight: 1.6,
            }}
          >
            {events.map((ev, i) => {
              const color = ev.level === "ok"
                ? "var(--accent)"
                : ev.level === "error" || ev.level === "warn"
                  ? "var(--warning)"
                  : "var(--text-dim)";
              return (
                <div key={i} style={{ color }}>{ev.message}</div>
              );
            })}
          </pre>
        </div>
      )}

      <NavButtons
        back="manifest-review"
        next="handoff"
        nextLabel="Continue to handoff →"
        nextDisabled={status === "running"}
      />
    </>
  );
}
