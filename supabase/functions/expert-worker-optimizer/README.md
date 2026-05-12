# expert-worker-optimizer (F.5)

Server-side worker for the `optimizer-v1` Expert Agent. Reads encrypted fleet digests, decrypts only the fields scoped to optimizer-v1, calls Anthropic to generate a board-level direction, signs the output, and queues it for the customer's Liaison agent to deliver.

## Deploy

```bash
supabase functions deploy expert-worker-optimizer --no-verify-jwt
```

`--no-verify-jwt` because this is invoked by a scheduled cron, not a user.

## Required secrets

```bash
supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
supabase secrets set OPTIMIZER_V1_ENC_PRIVATE_B64=...
supabase secrets set OPTIMIZER_V1_SIGN_PRIVATE_B64=...
```

The private keys are generated locally on the operator's Mac by `scripts/expert-agents/generate-keypair.mjs` for the encryption side, and a similar Ed25519 generator for the signing side (lands with F.5.b).

## Schedule

After deploy, schedule via:

```bash
# Every 30 min (founder tier cadence)
supabase functions schedule expert-worker-optimizer --cron "*/30 * * * *"
```

## What it does each invocation

For each row in `wavex_os.hired_expert_agents` with `catalog_id='optimizer-v1'` and `status='active'`:

1. Read the latest non-expired `wavex_os.fleet_digests` for that `subscription_id`.
2. Decrypt only the `field_envelopes` addressed to `optimizer-v1` (other agents' fields stay sealed).
3. Insert one `wavex_os.digest_access_log` row (the customer's audit trail).
4. If `ANTHROPIC_API_KEY` is set: call Anthropic with the canonical prompt from `docs/prompts/optimizer-board-nudge.md`, signing the output with the Ed25519 private key, and insert into `wavex_os.injection_queue_v2`.
5. If `ANTHROPIC_API_KEY` is not set: return `skipped_no_anthropic`. The audit row is still written, so the operator can verify the wiring without burning inference budget.

## Response shape

```jsonc
{
  "ok": true,
  "catalog_id": "optimizer-v1",
  "processed": 3,
  "results": [
    { "hire_id": "uuid", "status": "ok", "injection_id": "uuid" },
    { "hire_id": "uuid", "status": "skipped", "reason": "no fresh digest for this customer" },
    { "hire_id": "uuid", "status": "skipped_no_anthropic", "reason": "..." }
  ]
}
```

## Observability

After each invocation:

```sql
-- Recent runs
select ran_at, status, model, cost_cents
from wavex_os.usage_ledger
where pool = 'C'
order by ran_at desc
limit 10;

-- What we read from each customer
select dal.accessed_at, hea.catalog_id, dal.fields_accessed
from wavex_os.digest_access_log dal
join wavex_os.hired_expert_agents hea on hea.id = dal.hired_agent_id
order by dal.accessed_at desc
limit 20;

-- Pending injections per customer
select subscription_id, count(*)
from wavex_os.injection_queue_v2
where consumed_at is null
group by subscription_id;
```
