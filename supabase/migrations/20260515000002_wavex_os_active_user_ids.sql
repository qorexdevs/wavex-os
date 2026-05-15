create or replace function public.wavex_os_active_user_ids()
returns setof uuid
language sql
security definer
set search_path to 'wavex_os', 'public'
as $function$
  select distinct user_id
  from wavex_os.subscriptions
  where status in ('active', 'trialing', 'past_due')
    and user_id is not null
$function$;

revoke all on function public.wavex_os_active_user_ids() from public, anon, authenticated;
grant execute on function public.wavex_os_active_user_ids() to service_role;

comment on function public.wavex_os_active_user_ids() is
  'Realtime worker user_id auto-discovery: returns distinct active/trialing/past_due customer user_ids. Service-role only.';
