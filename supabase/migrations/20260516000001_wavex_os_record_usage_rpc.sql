-- F.4 usage audit: writable usage_ledger via SECURITY DEFINER RPC.
--
-- Background: PostgREST only exposes schemas in db-schemas. `wavex_os` is not
-- in that list, so `supabase.schema('wavex_os').from('usage_ledger').insert()`
-- fails with PGRST106. This RPC lives in `public` and inserts on behalf of
-- service_role into `wavex_os.usage_ledger` from inside Postgres.
--
-- Column shape matches wavex_os.usage_ledger (verified 2026-05-16):
--   pool, install_id, email, ip_24, subscription_id, request_id, model,
--   prompt_tokens, completion_tokens, cache_read_tokens, cache_creation_tokens,
--   cost_cents, status, error_class, ran_at, device_id, deliverable_id, agent_id
--
-- Note: there is NO user_id column in usage_ledger — user attribution lives
-- via subscription_id → wavex_os.subscriptions.user_id.

create or replace function public.wavex_os_record_usage(
  p_pool text,
  p_subscription_id uuid,
  p_request_id text,
  p_model text,
  p_prompt_tokens integer,
  p_completion_tokens integer,
  p_cache_read_tokens integer,
  p_cache_creation_tokens integer,
  p_cost_cents integer,
  p_status text,
  p_device_id uuid default null,
  p_error_class text default null,
  p_install_id text default null,
  p_email text default null,
  p_ip_24 text default null,
  p_deliverable_id uuid default null,
  p_agent_id text default null
)
returns uuid
language sql
security definer
set search_path to 'wavex_os', 'public'
as $function$
  insert into wavex_os.usage_ledger (
    pool, subscription_id, request_id, model,
    prompt_tokens, completion_tokens, cache_read_tokens, cache_creation_tokens,
    cost_cents, status, device_id, error_class,
    install_id, email, ip_24, deliverable_id, agent_id, ran_at
  ) values (
    p_pool, p_subscription_id, p_request_id, p_model,
    p_prompt_tokens, p_completion_tokens, coalesce(p_cache_read_tokens, 0), coalesce(p_cache_creation_tokens, 0),
    p_cost_cents, p_status, p_device_id, p_error_class,
    p_install_id, p_email, p_ip_24, p_deliverable_id, p_agent_id, now()
  )
  returning id
$function$;

revoke all on function public.wavex_os_record_usage(text,uuid,text,text,integer,integer,integer,integer,integer,text,uuid,text,text,text,text,uuid,text) from public, anon, authenticated;
grant execute on function public.wavex_os_record_usage(text,uuid,text,text,integer,integer,integer,integer,integer,text,uuid,text,text,text,text,uuid,text) to service_role;

comment on function public.wavex_os_record_usage(text,uuid,text,text,integer,integer,integer,integer,integer,text,uuid,text,text,text,text,uuid,text) is
  'F.4 usage audit: insert one row into wavex_os.usage_ledger from public schema (so PostgREST/service_role can reach it). Service-role only.';
