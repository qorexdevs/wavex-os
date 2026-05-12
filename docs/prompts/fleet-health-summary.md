# Fleet health summary — one-paragraph digest for Meta Mission Control

**Purpose:** Render a single-paragraph human-readable summary of a customer fleet's last-24h health for the operator dashboard (the `admin/` package).

**Caller:** `admin/server.ts` — invoked at most once per customer per dashboard load (cached 5min).

**Pool:** platform — runs in the operator's Mac, against a fleet digest from Supabase. Uses Haiku.

**Model:** Haiku 4.5. ~2K input, ~200 output.

## Inputs

| Variable | Description | Source |
|---|---|---|
| `{{CUSTOMER_NAME}}` | Customer company name (or anonymized hash) | `wavex_os.subscriptions.metadata.company_name` |
| `{{TIER}}` | `founder | growth | custom` | subscription row |
| `{{KPI_DELTAS}}` | List of KPI {name, baseline, current, direction} for last 24h | `wavex_os.fleet_digests.digest->kpi_snapshots` |
| `{{ISSUE_COUNTS}}` | `{done, in_progress, blocked, cancelled}` 24h | fleet digest |
| `{{RESOURCE_STATE}}` | Latest System Reliability snapshot `{disk_pct, ram_pressure, inference_burn_pct}` | resource-snapshot endpoint |
| `{{OPTIMIZER_INJECTIONS_24H}}` | Count of injections we delivered to this fleet in last 24h | optimizer_runs query |

## Output schema

```jsonc
{
  "headline": "string ≤60 chars — the one sentence you'd tell the operator first",
  "status_color": "string — green | yellow | red",
  "body": "string ≤300 chars — supporting detail in one paragraph",
  "alert_for_operator": "boolean — true if anything needs Omar's attention this hour"
}
```

## Prompt body

```
You are summarizing a customer fleet's 24h health for the WaveX operator
dashboard. The operator reads ~10 of these per minute on a refresh.
Brevity over completeness.

Customer: {{CUSTOMER_NAME}} ({{TIER}} tier)

KPI movement (last 24h):
{{KPI_DELTAS}}

Issue throughput (last 24h):
{{ISSUE_COUNTS}}

Host resources (most recent snapshot):
{{RESOURCE_STATE}}

WaveX injections delivered (last 24h):
{{OPTIMIZER_INJECTIONS_24H}}

Decision rules for status_color:
- green: KPI deltas show ≥1 positive move; ratio of done : cancelled is
  ≥ 1:1; disk_pct < 80; inference_burn_pct < 70.
- red: ANY of — disk_pct ≥ 90; cancelled count > 3× done count;
  no done issues in 24h; resource_state shows orange/red on any axis.
- yellow: anything between.

alert_for_operator = true if:
- status_color = red, OR
- the customer is on Custom tier and any KPI regressed by ≥10%, OR
- the customer's subscription expires in <7 days (check trial_end in
  inputs if provided).

headline rules:
- If green: lead with the BIGGEST positive KPI delta. e.g. "MRR +$2.4K
  this 24h, fleet healthy."
- If yellow: lead with the most pressing concern in <60 chars. e.g.
  "Disk at 84%, no done issues in 6h."
- If red: lead with the action the operator needs to take. e.g.
  "Disk RED 91%, paged 2h ago — operator action needed."

body rules:
- 2-3 sentences. Reference SPECIFIC numbers from KPI_DELTAS and
  ISSUE_COUNTS. Don't generalize.
- Never speculate about cause; only describe state.
- Always end with what the System Reliability agent / CoS is doing
  about it (if anything).

Return ONLY the JSON object.
```

## Failure mode + fallback

If the LLM call fails, the dashboard renders a deterministic summary:

- `headline`: `"{{CUSTOMER_NAME}} — {{ISSUE_COUNTS.done}} done, {{ISSUE_COUNTS.cancelled}} cancelled (24h)"`
- `status_color`: derived from the same decision rules, computed in JS
- `body`: bullet list of the raw KPI deltas + resource state, no narrative

The deterministic version is always shipped alongside as the source of truth — the LLM version is just nicer prose. Pure progressive enhancement.

## Why this is a separate prompt

It would be tempting to merge this into the agent's CEO Review Report. But:

1. The CEO Review is fleet-internal (for the agents themselves to read).
2. This is operator-external (for Omar to read about HIS customers).
3. Different audiences, different voices, different lengths.

Keeping them separate also means the Meta MC dashboard works for customers who haven't subscribed to optimizer features (it reads only public state).
