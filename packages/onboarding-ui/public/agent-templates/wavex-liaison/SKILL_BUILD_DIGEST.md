# Liaison — building the fleet digest

The digest is the customer's local fleet state, structured into the **field-name vocabulary** defined by the Expert Agent catalog. You never invent field names. You never include fields outside the vocabulary.

## The vocabulary (in 2026-05-12 catalog v1)

| Field | What it contains | Used by |
|---|---|---|
| `kpi_snapshots` | Latest value per registered KPI, last 24h | Optimizer, Alignment, Concierge |
| `kpi_deltas` | (current − baseline) per KPI per cycle | Alignment, Concierge |
| `open_issue_titles` | Titles + status + priority of non-done issues. NO bodies. | Optimizer, Concierge |
| `issue_bodies` | Bodies of recent open issues (Concierge only) | Concierge |
| `fleet_status` | Aggregate counts: agents by status, by role | Optimizer |
| `agent_status` | Per-agent state. No identity-revealing free text. | Error Handler, Concierge |
| `failed_runs` | Recent agent run failures with signatures | Error Handler, Concierge |
| `error_signatures` | Rolled-up signature counts | Error Handler |
| `goal` | Meta-goal title + description | Alignment, Concierge |
| `monte_carlo_baseline` | Forecast vector for Alignment to compare against | Alignment |
| `comments` | Bodies of recent comments (Concierge only) | Concierge |

## How to assemble it

Call `tools/build-digest.mjs` which assembles the JSON:

```bash
PAPERCLIP_API_BASE=http://127.0.0.1:3100 \
PAPERCLIP_COMPANY_ID="${COMPANY_ID}" \
  node "${TOOLS_DIR}/build-digest.mjs" > /tmp/wavex-digest-$$.json
```

The script reads Paperclip's read-only endpoints + applies the vocabulary. Output is a single JSON object whose keys are a subset of the vocabulary above. Fields that came back empty (no KPI snapshots in 24h, no failed runs, etc.) are stripped — they don't waste envelope space.

## Verification

Per `SKILL_VERIFY_BEFORE_CLAIM`: confirm the digest size before claiming "uploaded N fields". The trivial probe:

```bash
jq 'keys | length' /tmp/wavex-digest-$$.json
```

Report the count in your cycle comment.

## When to drop fields manually

You don't. The catalog data_scope decides what gets uploaded. The customer's `synthetic_data_filters` table is applied by Paperclip queries upstream (per `SKILL_KPI_SYNTHETIC_FILTER.md`), so test traffic is already filtered out at the source.

## When the digest is empty

If `jq 'length' /tmp/wavex-digest-$$.json` returns 0, skip the upload entirely. There's nothing to encrypt and nothing for the workers to read. Mark the cycle in your comment as `digest_empty: true` and exit. The customer's fleet is fine — nothing has happened in 5 min that any hired agent cares about.
