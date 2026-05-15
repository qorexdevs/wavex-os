-- Phase F / Mission Control — read-only probe for company goal/KPI progress.
-- wavex_os.* is not REST-exposed; the WaveX plugin reaches goal data through
-- this SECURITY DEFINER RPC, same pattern as wavex_os_ops_fleet_health and the
-- other wavex_os_ops_* probes.
--
-- Source resolution (graceful, forward-compatible):
--   1. If wavex_os.company_manifests exists (concurrently created by another
--      agent) with a `goal jsonb` column, unnest goal rows from it.
--   2. Otherwise return an empty set — the plugin widget degrades gracefully.
--
-- Each returned row is one goal: label + current/target numeric progress +
-- unit, so the plugin can render a progress gauge without a charting lib.

create or replace function public.wavex_os_ops_company_goals()
returns table (
  company_id   uuid,
  goal_id      text,
  label        text,
  metric       text,
  current_value numeric,
  target_value  numeric,
  unit         text,
  status       text,
  updated_at   timestamptz
)
language plpgsql
security definer
set search_path to 'wavex_os', 'public'
as $$
begin
  if to_regclass('wavex_os.company_manifests') is not null then
    return query execute $q$
      select
        cm.id as company_id,
        coalesce(g.value->>'id', g.value->>'metric', 'goal') as goal_id,
        coalesce(g.value->>'label', g.value->>'name', g.value->>'metric', 'Goal') as label,
        coalesce(g.value->>'metric', g.value->>'kpi', '') as metric,
        nullif(g.value->>'current', '')::numeric as current_value,
        nullif(g.value->>'target', '')::numeric as target_value,
        coalesce(g.value->>'unit', '') as unit,
        coalesce(g.value->>'status', 'active') as status,
        cm.updated_at
      from wavex_os.company_manifests cm
      cross join lateral (
        select value
        from jsonb_array_elements(
          case
            when jsonb_typeof(cm.goal) = 'array' then cm.goal
            when cm.goal is null then '[]'::jsonb
            else jsonb_build_array(cm.goal)
          end
        )
      ) g
      order by cm.updated_at desc
      limit 50
    $q$;
  else
    -- company_manifests not provisioned yet — return empty so the widget
    -- shows its "no goals" empty state instead of erroring.
    return;
  end if;
end;
$$;

comment on function public.wavex_os_ops_company_goals() is
  'Mission Control goals probe: per-company goal rows (current/target progress) from wavex_os.company_manifests.goal jsonb when that table exists; empty set otherwise. Operator-scoped, service-role caller (matches wavex_os_ops_* convention). Not exposed to anon/authenticated.';

-- Tighter than the legacy wavex_os_ops_* funcs: service-role only.
revoke all on function public.wavex_os_ops_company_goals() from public, anon, authenticated;
grant execute on function public.wavex_os_ops_company_goals() to service_role;
