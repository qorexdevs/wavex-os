-- P3 / WAVEX_LOCAL_OPS_PUSH — extend wavex_os.instance_health so the customer's
-- local-ops daemon (scripts/wavex-local-ops-cycle.mjs) can push its full state
-- file to the cloud each cycle.  The admin fleet UI reads these columns.
--
-- Both columns are nullable + add-only so legacy Liaison pushes (Phase 1 task
-- #123) keep working unchanged.
--
-- Also adds a SECURITY DEFINER RPC the os-instance-health Edge Function calls
-- to perform the insert without exposing wavex_os.* over PostgREST.

alter table wavex_os.instance_health
  add column if not exists local_ops_state jsonb,
  add column if not exists requires_user_action jsonb;

comment on column wavex_os.instance_health.local_ops_state is
  'Full local-ops-state.json blob pushed by scripts/wavex-local-ops-cycle.mjs each cycle (schema_version=1). Lets the operator console replay exactly what the customer''s daemon saw without joining other tables.';

comment on column wavex_os.instance_health.requires_user_action is
  'Mirror of state.requires_user_action so the operator console can surface "this customer needs to click X" without parsing local_ops_state.';

create index if not exists instance_health_attention_user_action_idx
  on wavex_os.instance_health (reported_at desc)
  where requires_user_action is not null;

-- RPC: insert one health row.  Used by the os-instance-health Edge Function
-- after it validates the device JWT.  service-role only; SECURITY DEFINER so
-- it bypasses the customer RLS policies (the Edge Function is the
-- authentication boundary).
create or replace function public.os_record_instance_health(
  _device_id uuid,
  _subscription_id uuid,
  _tier text,
  _paperclip_reachable boolean,
  _agents_idle int,
  _agents_running int,
  _agents_error int,
  _fleet_status text,
  _recent_errors jsonb,
  _last_heartbeat_at timestamptz,
  _local_ops_state jsonb,
  _requires_user_action jsonb
) returns table (id uuid)
language sql
security definer
set search_path to 'wavex_os', 'public'
as $function$
  insert into wavex_os.instance_health (
    device_id, subscription_id, tier, paperclip_reachable,
    agent_count, agents_idle, agents_running, agents_error,
    fleet_status, recent_errors, last_heartbeat_at,
    local_ops_state, requires_user_action
  )
  values (
    _device_id, _subscription_id,
    coalesce(_tier, 'pool_a'),
    coalesce(_paperclip_reachable, false),
    coalesce(_agents_idle, 0) + coalesce(_agents_running, 0) + coalesce(_agents_error, 0),
    coalesce(_agents_idle, 0),
    coalesce(_agents_running, 0),
    coalesce(_agents_error, 0),
    coalesce(_fleet_status, 'down'),
    coalesce(_recent_errors, '[]'::jsonb),
    _last_heartbeat_at,
    _local_ops_state,
    _requires_user_action
  )
  returning wavex_os.instance_health.id;
$function$;

revoke all on function public.os_record_instance_health(uuid, uuid, text, boolean, int, int, int, text, jsonb, timestamptz, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.os_record_instance_health(uuid, uuid, text, boolean, int, int, int, text, jsonb, timestamptz, jsonb, jsonb) to service_role;

comment on function public.os_record_instance_health(uuid, uuid, text, boolean, int, int, int, text, jsonb, timestamptz, jsonb, jsonb) is
  'Edge-function-only insert into wavex_os.instance_health from the customer''s local-ops daemon. The Edge Function authenticates the device JWT, then calls this. Service-role only.';
