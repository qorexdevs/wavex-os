-- WaveX OS — public RPC wrappers for wavex_os.partner_events
--
-- PostgREST only exposes the public schema (and a few others).
-- wavex_os tables are server-side only; these thin wrappers give the
-- service-role key a reachable /rest/v1/rpc/ endpoint for the
-- partner-events Fastify route.
--
-- Functions:
--   wavex_os_emit_partner_event  — insert one row, return {id}
--   wavex_os_get_partner_events  — read all events for a partner_id

create or replace function wavex_os_emit_partner_event(
  p_partner_id   text,
  p_event_type   text,
  p_fired_at     timestamptz,
  p_context_json jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = wavex_os, public
as $$
declare
  v_id uuid;
begin
  insert into wavex_os.partner_events(partner_id, event_type, fired_at, context_json)
  values (p_partner_id, p_event_type, p_fired_at, p_context_json)
  returning id into v_id;
  return jsonb_build_object('id', v_id);
end;
$$;

comment on function wavex_os_emit_partner_event is
  'Service-role RPC: insert one row into wavex_os.partner_events and return {id}. '
  'Used by the Fastify partner-events route; wavex_os schema is not exposed to PostgREST.';

create or replace function wavex_os_get_partner_events(p_partner_id text)
returns jsonb
language plpgsql
security definer
set search_path = wavex_os, public
as $$
begin
  return (
    select coalesce(jsonb_agg(row_to_json(e)::jsonb order by e.fired_at desc), '[]'::jsonb)
    from wavex_os.partner_events e
    where e.partner_id = p_partner_id
  );
end;
$$;

comment on function wavex_os_get_partner_events is
  'Service-role RPC: return all wavex_os.partner_events rows for a partner_id as JSON array.';
