-- Phase 2 — operator watchdog reads latest instance_health per device.
-- wavex_os.* is not REST-exposed; the ops-cycle reaches it through this
-- SECURITY DEFINER RPC, same pattern as the other wavex_os_ops_* probes.
-- Returns latest row per device + the joined subscription status so the
-- watchdog can tell paid (pool_b active/trialing) fleets from free.

create or replace function public.wavex_os_ops_fleet_health()
returns table (
  device_id              uuid,
  subscription_id        uuid,
  tier                   text,
  subscription_status    text,
  hostname               text,
  device_name            text,
  fleet_status           text,
  reported_at            timestamptz,
  last_heartbeat_at      timestamptz,
  paperclip_reachable    boolean,
  paperclip_version      text,
  agent_count            int,
  agents_error           int,
  runs_last_hour         int,
  runs_failed_last_hour  int,
  recent_errors          jsonb,
  staleness_minutes      numeric
)
language sql
security definer
set search_path to 'wavex_os', 'public'
as $$
  select distinct on (ih.device_id)
    ih.device_id,
    ih.subscription_id,
    ih.tier,
    s.status as subscription_status,
    d.hostname,
    d.name   as device_name,
    ih.fleet_status,
    ih.reported_at,
    ih.last_heartbeat_at,
    ih.paperclip_reachable,
    ih.paperclip_version,
    ih.agent_count,
    ih.agents_error,
    ih.runs_last_hour,
    ih.runs_failed_last_hour,
    ih.recent_errors,
    round(extract(epoch from (now() - ih.reported_at)) / 60.0, 1) as staleness_minutes
  from wavex_os.instance_health ih
  join wavex_os.os_devices d on d.id = ih.device_id
  left join wavex_os.subscriptions s on s.id = ih.subscription_id
  order by ih.device_id, ih.reported_at desc;
$$;

comment on function public.wavex_os_ops_fleet_health() is
  'Phase 2 watchdog probe: latest instance_health row per device + subscription status. Operator-scoped, service-role caller (matches wavex_os_ops_* convention). Not exposed to anon/authenticated.';

-- Tighter than the legacy wavex_os_ops_* funcs: service-role only.
revoke all on function public.wavex_os_ops_fleet_health() from public, anon, authenticated;
grant execute on function public.wavex_os_ops_fleet_health() to service_role;
