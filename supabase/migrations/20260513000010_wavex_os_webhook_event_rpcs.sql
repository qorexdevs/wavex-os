-- Idempotency + error-recording RPCs for wavex-os-subscription-webhook.
-- See 20260513000009_*.sql for why we use RPCs instead of .schema('wavex_os').

create or replace function public.wavex_os_record_webhook_event(
  p_id text,
  p_type text,
  p_api_version text,
  p_payload jsonb
) returns table (is_duplicate boolean)
language plpgsql
security definer
set search_path = wavex_os, public
as $$
begin
  begin
    insert into wavex_os.stripe_webhook_events (id, type, api_version, payload)
      values (p_id, p_type, p_api_version, p_payload);
    return query select false;
  exception when unique_violation then
    return query select true;
  end;
end;
$$;

create or replace function public.wavex_os_mark_webhook_event_error(
  p_id text,
  p_error text
) returns void
language sql
security definer
set search_path = wavex_os, public
as $$
  update wavex_os.stripe_webhook_events
     set processing_error = p_error
   where id = p_id;
$$;

revoke all on function public.wavex_os_record_webhook_event(text, text, text, jsonb) from public;
revoke all on function public.wavex_os_mark_webhook_event_error(text, text) from public;
grant execute on function public.wavex_os_record_webhook_event(text, text, text, jsonb) to service_role;
grant execute on function public.wavex_os_mark_webhook_event_error(text, text) to service_role;
