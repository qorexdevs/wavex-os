-- Phase 6 / OPERATIONAL_LAYER.md §1 — read-only probe over the unified
-- accountability record. wavex_os.* is not REST-exposed; the WaveX plugin
-- reaches deliverable_ledger through this SECURITY DEFINER RPC, same pattern
-- as wavex_os_ops_fleet_health and the other wavex_os_ops_* probes.
-- Returns recent deliverables (newest by updated_at, capped) with the
-- accountability contract + total TOKEN cost. Economics are in tokens,
-- never USD.

create or replace function public.wavex_os_ops_deliverable_summary()
returns table (
  id                 uuid,
  assigned_agent     text,
  plan_ref           text,
  expected_response  text,
  kind               text,
  status             text,
  issue_id           text,
  total_tokens       bigint,
  updated_at         timestamptz
)
language sql
security definer
set search_path to 'wavex_os', 'public'
as $$
  select
    dl.id,
    dl.assigned_agent,
    dl.plan_ref,
    dl.expected_response,
    dl.kind,
    dl.status,
    dl.issue_id,
    (dl.tokens_in + dl.tokens_out + dl.tokens_cache) as total_tokens,
    dl.updated_at
  from wavex_os.deliverable_ledger dl
  order by dl.updated_at desc
  limit 50;
$$;

comment on function public.wavex_os_ops_deliverable_summary() is
  'Phase 6 deliverables probe: 50 most-recent deliverable_ledger rows + total token cost. Operator-scoped, service-role caller (matches wavex_os_ops_* convention). Not exposed to anon/authenticated.';

-- Tighter than the legacy wavex_os_ops_* funcs: service-role only.
revoke all on function public.wavex_os_ops_deliverable_summary() from public, anon, authenticated;
grant execute on function public.wavex_os_ops_deliverable_summary() to service_role;
