// Server-side HTML template for the WaveX OS Meta Mission Control dashboard.
// Pure template literal — no framework, no client-side JS beyond a tiny refresh helper.

export type Subscription = {
  id: string;
  user_id: string;
  tier: string | null;
  status: string | null;
  current_period_end: string | null;
  days_until_renewal: number | null;
  last_fleet_digest_received: string | null;
};

export type OptimizerRun = {
  id: string;
  subscription_id: string | null;
  kind: string | null;
  model: string | null;
  cost_cents: number | null;
  status: string | null;
  ran_at: string | null;
};

export type InjectionQueueItem = {
  id: string;
  subscription_id: string | null;
  kind: string | null;
  expires_at: string | null;
  created_at: string | null;
};

export type DashboardData = {
  generatedAt: string;
  viewerEmail: string;
  subscriptions: Subscription[];
  optimizerRuns: OptimizerRun[];
  injectionQueue: InjectionQueueItem[];
};

// Escape user-controlled strings before interpolating into HTML.
function esc(value: unknown): string {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function fmtDate(value: string | null): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return esc(value);
  return d.toISOString().replace('T', ' ').slice(0, 19) + 'Z';
}

function fmtCents(value: number | null): string {
  if (value === null || value === undefined) return '—';
  return `$${(value / 100).toFixed(2)}`;
}

function statusPill(status: string | null): string {
  const s = (status ?? '').toLowerCase();
  const cls =
    s === 'active' || s === 'succeeded' || s === 'success'
      ? 'pill-ok'
      : s === 'failed' || s === 'error' || s === 'canceled'
        ? 'pill-bad'
        : 'pill-neutral';
  return `<span class="pill ${cls}">${esc(status ?? '—')}</span>`;
}

function renderSubscriptionsTable(rows: Subscription[]): string {
  if (rows.length === 0) {
    return '<p class="empty">No active subscriptions.</p>';
  }
  return `
    <table>
      <thead>
        <tr>
          <th>user_id</th>
          <th>tier</th>
          <th>status</th>
          <th>current_period_end</th>
          <th>days_until_renewal</th>
          <th>last_fleet_digest</th>
        </tr>
      </thead>
      <tbody>
        ${rows
          .map(
            (r) => `
          <tr>
            <td class="mono">${esc(r.user_id)}</td>
            <td>${esc(r.tier)}</td>
            <td>${statusPill(r.status)}</td>
            <td class="mono">${fmtDate(r.current_period_end)}</td>
            <td class="num">${r.days_until_renewal ?? '—'}</td>
            <td class="mono">${fmtDate(r.last_fleet_digest_received)}</td>
          </tr>`,
          )
          .join('')}
      </tbody>
    </table>
  `;
}

function renderOptimizerRunsTable(rows: OptimizerRun[]): string {
  if (rows.length === 0) {
    return '<p class="empty">No optimizer runs yet.</p>';
  }
  return `
    <table>
      <thead>
        <tr>
          <th>subscription_id</th>
          <th>kind</th>
          <th>model</th>
          <th>cost</th>
          <th>status</th>
          <th>ran_at</th>
        </tr>
      </thead>
      <tbody>
        ${rows
          .map(
            (r) => `
          <tr>
            <td class="mono">${esc(r.subscription_id)}</td>
            <td>${esc(r.kind)}</td>
            <td>${esc(r.model)}</td>
            <td class="num">${fmtCents(r.cost_cents)}</td>
            <td>${statusPill(r.status)}</td>
            <td class="mono">${fmtDate(r.ran_at)}</td>
          </tr>`,
          )
          .join('')}
      </tbody>
    </table>
  `;
}

function renderInjectionQueueTable(rows: InjectionQueueItem[]): string {
  if (rows.length === 0) {
    return '<p class="empty">Injection queue is empty.</p>';
  }
  return `
    <table>
      <thead>
        <tr>
          <th>subscription_id</th>
          <th>kind</th>
          <th>expires_at</th>
          <th>created_at</th>
        </tr>
      </thead>
      <tbody>
        ${rows
          .map(
            (r) => `
          <tr>
            <td class="mono">${esc(r.subscription_id)}</td>
            <td>${esc(r.kind)}</td>
            <td class="mono">${fmtDate(r.expires_at)}</td>
            <td class="mono">${fmtDate(r.created_at)}</td>
          </tr>`,
          )
          .join('')}
      </tbody>
    </table>
  `;
}

export function renderDashboard(data: DashboardData): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>WaveX OS — Meta Mission Control</title>
  <style>
    :root {
      --bg: #0b0d10;
      --panel: #14171c;
      --border: #232830;
      --text: #e6e8ea;
      --muted: #8a929c;
      --accent: #4ea1ff;
      --ok: #2ecc71;
      --bad: #ff5a5a;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      background: var(--bg);
      color: var(--text);
      font: 14px/1.5 ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
    }
    header {
      padding: 16px 24px;
      border-bottom: 1px solid var(--border);
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 8px;
    }
    header h1 { margin: 0; font-size: 18px; font-weight: 600; }
    header .meta { color: var(--muted); font-size: 12px; }
    main { padding: 24px; display: grid; gap: 24px; }
    .panel {
      background: var(--panel);
      border: 1px solid var(--border);
      border-radius: 8px;
      overflow: hidden;
    }
    .panel h2 {
      margin: 0;
      padding: 12px 16px;
      font-size: 14px;
      font-weight: 600;
      border-bottom: 1px solid var(--border);
    }
    .panel-body { overflow-x: auto; }
    table { width: 100%; border-collapse: collapse; }
    th, td {
      text-align: left;
      padding: 8px 16px;
      border-bottom: 1px solid var(--border);
      white-space: nowrap;
    }
    th {
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--muted);
      font-weight: 500;
    }
    tr:last-child td { border-bottom: 0; }
    .mono { font-family: ui-monospace, "SF Mono", Menlo, monospace; font-size: 12px; }
    .num { text-align: right; font-variant-numeric: tabular-nums; }
    .empty { padding: 16px; color: var(--muted); margin: 0; }
    .pill {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 999px;
      font-size: 11px;
      font-weight: 500;
    }
    .pill-ok { background: rgba(46,204,113,0.15); color: var(--ok); }
    .pill-bad { background: rgba(255,90,90,0.15); color: var(--bad); }
    .pill-neutral { background: rgba(138,146,156,0.15); color: var(--muted); }
    a.refresh {
      color: var(--accent);
      text-decoration: none;
      font-size: 12px;
    }
    a.refresh:hover { text-decoration: underline; }
  </style>
</head>
<body>
  <header>
    <h1>WaveX OS — Meta Mission Control</h1>
    <div class="meta">
      signed in as <span class="mono">${esc(data.viewerEmail)}</span>
      &middot; generated <span class="mono">${fmtDate(data.generatedAt)}</span>
      &middot; <a class="refresh" href="/admin">refresh</a>
    </div>
  </header>
  <main>
    <section class="panel">
      <h2>Active subscriptions (${data.subscriptions.length})</h2>
      <div class="panel-body">${renderSubscriptionsTable(data.subscriptions)}</div>
    </section>
    <section class="panel">
      <h2>Recent optimizer runs (${data.optimizerRuns.length})</h2>
      <div class="panel-body">${renderOptimizerRunsTable(data.optimizerRuns)}</div>
    </section>
    <section class="panel">
      <h2>Pending injection queue (${data.injectionQueue.length})</h2>
      <div class="panel-body">${renderInjectionQueueTable(data.injectionQueue)}</div>
    </section>
  </main>
</body>
</html>`;
}

export function renderError(status: number, title: string, detail: string): string {
  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><title>${esc(status)} ${esc(title)}</title>
<style>body{font:14px/1.5 system-ui,sans-serif;background:#0b0d10;color:#e6e8ea;margin:0;padding:48px;}
h1{margin:0 0 8px;font-size:20px}p{color:#8a929c}code{font-family:ui-monospace,Menlo,monospace}</style>
</head><body><h1>${esc(status)} — ${esc(title)}</h1><p>${esc(detail)}</p></body></html>`;
}
