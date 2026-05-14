-- Phase F.4 wiring (2026-05-14) — the Liaison's Pool C queue-pull bridge.
-- wavex_os.* is not REST-exposed; the inference-server reaches
-- injection_queue_v2 through this SECURITY DEFINER RPC. Returns unconsumed,
-- unexpired signed injections for a subscription, with keyset pagination on
-- created_at. The /v1/optimizer/queue endpoint gates on subscription-active
-- BEFORE calling this — but lock the RPC to service_role anyway so a stray
-- authenticated caller cannot enumerate another subscription's queue.

create or replace function public.wavex_os_injection_queue_pull(
  p_subscription_id uuid,
  p_last_seen_injection_id uuid default null::uuid
)
returns table (
  id                   uuid,
  subscription_id      uuid,
  hired_agent_id       uuid,
  catalog_id           text,
  kind                 text,
  payload              jsonb,
  issued_by_catalog_id text,
  issued_at            timestamptz,
  signature_b64        text,
  created_at           timestamptz
)
language sql
security definer
set search_path to 'wavex_os', 'public'
as $function$
  select q.id, q.subscription_id, q.hired_agent_id, q.catalog_id, q.kind,
         q.payload, q.issued_by_catalog_id, q.issued_at, q.signature_b64,
         q.created_at
  from wavex_os.injection_queue_v2 q
  where q.subscription_id = p_subscription_id
    and q.consumed_at is null
    and (q.expires_at is null or q.expires_at > now())
    and (
      p_last_seen_injection_id is null
      or q.created_at > (
        select s.created_at
        from wavex_os.injection_queue_v2 s
        where s.id = p_last_seen_injection_id
      )
    )
  order by q.created_at asc
$function$;

comment on function public.wavex_os_injection_queue_pull(uuid, uuid) is
  'F.4 Liaison queue-pull bridge: unconsumed/unexpired signed injections for a subscription, keyset-paginated on created_at. Service-role only (called by inference-server /v1/optimizer/queue, which gates on subscription-active first).';

revoke all on function public.wavex_os_injection_queue_pull(uuid, uuid) from public, anon, authenticated;
grant execute on function public.wavex_os_injection_queue_pull(uuid, uuid) to service_role;
