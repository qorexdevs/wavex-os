-- WaveX Mission Control V2 — admin RPC for per-customer overview.
-- Used by customer-success-engineer + platform-reliability-engineer agents
-- (scripts/ops/admin-instance/agents/) to read the paying-customer fleet
-- under service_role from a single signed entry point.
--
-- The instance_health.requires_user_action column ships with P3
-- (20260516000004_wavex_os_instance_health_local_ops_columns.sql). The RPC
-- is tolerant of either ordering: if the column is missing, the field is
-- returned as NULL so a partial deploy still works.

create or replace function public.wavex_os_admin_customer_overview()
returns table (
  user_id uuid,
  email text,
  tier text,
  subscription_status text,
  current_period_end timestamptz,
  trial_end timestamptz,
  device_count int,
  last_heartbeat_at timestamptz,
  fleet_status text,
  requires_user_action jsonb,
  tokens_last_7d bigint,
  cost_cents_last_7d bigint
)
language plpgsql
security definer
set search_path to 'wavex_os', 'public', 'auth'
as $function$
declare
  has_rua boolean;
  sql text;
begin
  select exists (
    select 1 from information_schema.columns
    where table_schema = 'wavex_os'
      and table_name = 'instance_health'
      and column_name = 'requires_user_action'
  ) into has_rua;

  sql := format($sql$
    with latest_health as (
      select distinct on (h.subscription_id)
        h.subscription_id,
        h.reported_at,
        h.fleet_status,
        %s as requires_user_action
      from wavex_os.instance_health h
      order by h.subscription_id, h.reported_at desc
    )
    select
      s.user_id,
      u.email::text as email,
      s.tier,
      s.status,
      s.current_period_end,
      s.trial_end,
      coalesce((
        select count(*)::int
        from wavex_os.os_devices d
        where d.user_id = s.user_id
          and d.status <> 'revoked'
      ), 0) as device_count,
      lh.reported_at as last_heartbeat_at,
      lh.fleet_status,
      lh.requires_user_action,
      coalesce((
        select sum(prompt_tokens + completion_tokens)::bigint
        from wavex_os.usage_ledger l
        where l.subscription_id = s.id
          and l.ran_at > now() - interval '7 days'
      ), 0) as tokens_last_7d,
      coalesce((
        select sum(cost_cents)::bigint
        from wavex_os.usage_ledger l
        where l.subscription_id = s.id
          and l.ran_at > now() - interval '7 days'
      ), 0) as cost_cents_last_7d
    from wavex_os.subscriptions s
    left join auth.users u on u.id = s.user_id
    left join latest_health lh on lh.subscription_id = s.id
    where s.status in ('active', 'trialing', 'past_due')
    order by s.current_period_end nulls last
  $sql$, case when has_rua then 'h.requires_user_action' else 'null::jsonb' end);

  return query execute sql;
end;
$function$;

revoke all on function public.wavex_os_admin_customer_overview() from public, anon, authenticated;
grant execute on function public.wavex_os_admin_customer_overview() to service_role;
