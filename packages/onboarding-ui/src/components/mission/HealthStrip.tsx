import { useEffect, useState } from "react";

interface HealthData {
  ok: boolean;
  service?: string;
  version?: string;
  agents?: number;
  runs?: number;
  companyDir?: string;
  fetchedAt: number;
  reachable: boolean;
}

export function HealthStrip() {
  const [health, setHealth] = useState<HealthData | null>(null);

  useEffect(() => {
    let alive = true;
    async function poll() {
      try {
        const resp = await fetch("/api/paperclip/health");
        const data = await resp.json();
        if (alive) setHealth({ ...data, fetchedAt: Date.now(), reachable: true });
      } catch {
        if (alive) setHealth({ ok: false, fetchedAt: Date.now(), reachable: false });
      }
    }
    poll();
    const id = setInterval(poll, 5_000);
    return () => { alive = false; clearInterval(id); };
  }, []);

  if (!health) {
    return <div className="text-dim" style={{ fontSize: 12 }}>checking core…</div>;
  }

  const dotColor = health.reachable && health.ok ? "var(--accent)" : "var(--danger)";
  const label = !health.reachable
    ? "core unreachable"
    : health.ok
      ? `${health.service ?? "core"} ${health.version ?? ""} · ${health.agents ?? 0} agents`
      : "core degraded";

  return (
    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: 12, color: "var(--text-dim)" }}>
      <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", background: dotColor }} />
      <span>{label}</span>
    </div>
  );
}
