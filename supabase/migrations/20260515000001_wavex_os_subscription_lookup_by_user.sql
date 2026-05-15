create or replace function public.wavex_os_subscription_lookup_by_user(
  p_user_id uuid
)
returns table (
  id uuid,
  tier text,
  status text
)
language sql
security definer
set search_path to 'wavex_os', 'public'
as $function$
  select s.id, s.tier, s.status
  from wavex_os.subscriptions s
  where s.user_id = p_user_id
    and s.status in ('active', 'trialing', 'past_due')
  order by s.current_period_end desc
  limit 1
$function$;

revoke all on function public.wavex_os_subscription_lookup_by_user(uuid) from public, anon, authenticated;
grant execute on function public.wavex_os_subscription_lookup_by_user(uuid) to service_role;

comment on function public.wavex_os_subscription_lookup_by_user(uuid) is
  'Realtime worker subscription gate: returns most recent active/trialing/past_due subscription for a given user_id. Service-role only.';
