#!/usr/bin/env node
/**
 * build-digest.mjs — assembles a JSON fleet digest from local Paperclip.
 *
 * Invoked by the Liaison agent every heartbeat. Output goes to stdout as
 * one JSON object whose keys match the field-name vocabulary in
 * `expert_agent_catalog.data_scope`. The Liaison then pipes this into
 * encrypt-envelopes.mjs which keeps only the fields needed by the
 * currently-hired agents.
 *
 * Reads from:
 *   - PAPERCLIP_API_BASE (default http://127.0.0.1:3100)
 *   - PAPERCLIP_COMPANY_ID  (required)
 *
 * Never includes anything not explicitly tagged with a recognized field
 * name — the catalog data_scope vocabulary is the contract.
 */
const PAPERCLIP = process.env.PAPERCLIP_API_BASE ?? "http://127.0.0.1:3100";
const COMPANY = process.env.PAPERCLIP_COMPANY_ID;
if (!COMPANY) {
  console.error("PAPERCLIP_COMPANY_ID required");
  process.exit(1);
}

async function fetchJson(path, fallback = null) {
  try {
    const r = await fetch(`${PAPERCLIP}${path}`, { signal: AbortSignal.timeout(8000) });
    if (!r.ok) return fallback;
    return await r.json();
  } catch {
    return fallback;
  }
}

const [issues, agents, goals, runs] = await Promise.all([
  fetchJson(`/api/companies/${COMPANY}/issues?limit=200`, []),
  fetchJson(`/api/companies/${COMPANY}/agents`, []),
  fetchJson(`/api/companies/${COMPANY}/goals`, []),
  fetchJson(`/api/companies/${COMPANY}/runs?status=failed&limit=50`, []),
]);

const issueList = Array.isArray(issues) ? issues : issues?.items ?? [];
const agentList = Array.isArray(agents) ? agents : agents?.items ?? [];
const goalList  = Array.isArray(goals)  ? goals  : goals?.items  ?? [];
const runList   = Array.isArray(runs)   ? runs   : runs?.items   ?? [];

// ─── Compose digest fields. Names match catalog.data_scope vocabulary. ──

const digest = {
  // ── kpi_snapshots: latest value per kpi (last 24h) ────────────────
  kpi_snapshots: (await fetchJson(`/api/companies/${COMPANY}/kpis?since=24h`, []))
    ?.map?.((k) => ({ name: k.name, value: k.value, measured_at: k.measured_at }))
    ?? [],

  // ── kpi_deltas: (latest - baseline) per kpi over the last cycle ───
  kpi_deltas: (await fetchJson(`/api/companies/${COMPANY}/kpis?delta=true`, []))
    ?.map?.((k) => ({ name: k.name, delta: k.delta, observed_at: k.observed_at }))
    ?? [],

  // ── open_issue_titles: titles only, no bodies, of non-done issues ─
  open_issue_titles: issueList
    .filter((i) => !["done", "cancelled"].includes(i.status))
    .slice(0, 100)
    .map((i) => ({ key: i.key, title: i.title, status: i.status, priority: i.priority })),

  // ── issue_bodies: only for concierge-v1 (will be filtered out for
  //    optimizer/alignment/error-handler by the catalog scope check)
  issue_bodies: issueList
    .filter((i) => !["done", "cancelled"].includes(i.status))
    .slice(0, 30)
    .map((i) => ({ key: i.key, title: i.title, body: (i.description ?? "").slice(0, 2000) })),

  // ── fleet_status: aggregate counts only ──────────────────────────
  fleet_status: {
    agents_total: agentList.length,
    by_status: agentList.reduce((acc, a) => { acc[a.status] = (acc[a.status] ?? 0) + 1; return acc; }, {}),
    by_role: agentList.reduce((acc, a) => { acc[a.role] = (acc[a.role] ?? 0) + 1; return acc; }, {}),
  },

  // ── agent_status: per-agent state without identity-revealing fields ──
  agent_status: agentList.map((a) => ({
    id: a.id,
    role: a.role,
    status: a.status,
    last_heartbeat_minutes_ago: a.lastHeartbeatAt
      ? Math.floor((Date.now() - new Date(a.lastHeartbeatAt).getTime()) / 60000)
      : null,
  })),

  // ── failed_runs: signatures + reasons, no identifying free text ──
  failed_runs: runList.slice(0, 50).map((r) => ({
    agent_id: r.agentId,
    issue_key: r.issueKey,
    error_class: r.errorClass ?? null,
    error_signature: (r.errorMessage ?? "").slice(0, 200),
    occurred_at: r.startedAt,
  })),

  // ── error_signatures: rolled-up signature counts ─────────────────
  error_signatures: (() => {
    const sigs = {};
    for (const r of runList) {
      const s = (r.errorClass ?? r.errorMessage ?? "unknown").slice(0, 100);
      sigs[s] = (sigs[s] ?? 0) + 1;
    }
    return Object.entries(sigs).map(([sig, count]) => ({ signature: sig, count })).sort((a, b) => b.count - a.count);
  })(),

  // ── goal: meta-goal text + progress ──────────────────────────────
  goal: goalList[0]
    ? { id: goalList[0].id, title: goalList[0].title, description: goalList[0].description }
    : null,

  // ── monte_carlo_baseline: forecast vector for alignment to read ──
  monte_carlo_baseline: await fetchJson(`/api/companies/${COMPANY}/monte-carlo-baseline`, null),

  // ── comments: only for concierge — bodies of recent comments ─────
  comments: (await fetchJson(`/api/companies/${COMPANY}/comments?limit=50`, []))
    ?.map?.((c) => ({ issue_key: c.issueKey, author_role: c.authorRole, body: (c.body ?? "").slice(0, 1000), posted_at: c.createdAt }))
    ?? [],
};

// Strip undefined / null fields to keep envelope size down.
for (const k of Object.keys(digest)) {
  if (digest[k] == null || (Array.isArray(digest[k]) && digest[k].length === 0)) {
    delete digest[k];
  }
}

process.stdout.write(JSON.stringify(digest));
