-- Public-schema RPC that the refresh-subscription-jwt edge function calls.
-- Cannot use Supabase client's .schema('wavex_os') because PostgREST exposes
-- only public, graphql_public, meta_ads. Adding wavex_os to that list is
-- a project-level dashboard setting; this RPC avoids needing it.

create or replace function public.wavex_os_subscription_lookup(p_subscription_id uuid)
returns table (
  id uuid,
  tier text,
  status text
)
language sql
security definer
set search_path = wavex_os, public
as $$
  select s.id, s.tier, s.status
  from wavex_os.subscriptions s
  where s.id = p_subscription_id
$$;

revoke all on function public.wavex_os_subscription_lookup(uuid) from public;
grant execute on function public.wavex_os_subscription_lookup(uuid) to service_role;

comment on function public.wavex_os_subscription_lookup(uuid) is
  'Edge-function-callable bridge to wavex_os.subscriptions. Bypasses PostgREST schema-exposure limit. Called by refresh-subscription-jwt (F.4.f) with the service_role key.';
