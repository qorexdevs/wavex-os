-- os_admin_list_devices previously queried public.subscribers (a WaveX Experiences
-- legacy table that doesn't exist in this project). The admin device-list query
-- silently fell back to 'free' for every row at best, and at worst raised
-- relation "public.subscribers" does not exist depending on caller.
--
-- Same fix as commit 86bdd1d1 (os_create_device): point at wavex_os.subscriptions
-- with the real wavex-os tier enum (founder | growth | custom) and the canonical
-- ACTIVE_STATUSES (trialing | active | past_due). Default tier when no row exists
-- is 'free'.

create or replace function public.os_admin_list_devices()
returns table (
  id uuid,
  user_id uuid,
  email text,
  name text,
  kind text,
  status text,
  hostname text,
  os_version text,
  last_seen_at timestamp with time zone,
  created_at timestamp with time zone,
  is_running boolean,
  tier text
)
language plpgsql
security definer
set search_path to 'public', 'wavex_os'
as $function$
begin
  if not public.has_role(auth.uid(), 'admin') then
    raise exception 'forbidden';
  end if;

  return query
  select
    d.id,
    d.user_id,
    u.email::text,
    d.name,
    d.kind,
    d.status,
    d.hostname,
    d.os_version,
    d.last_seen_at,
    d.created_at,
    (d.last_seen_at is not null and d.last_seen_at > now() - interval '5 minutes') as is_running,
    coalesce(
      (select s.tier::text
         from wavex_os.subscriptions s
        where s.user_id = d.user_id
          and s.status in ('active', 'trialing', 'past_due')
        order by s.current_period_end desc nulls last,
                 s.updated_at         desc nulls last,
                 s.created_at         desc nulls last
        limit 1),
      'free'
    ) as tier
  from wavex_os.os_devices d
  left join auth.users u on u.id = d.user_id
  order by (d.last_seen_at is not null and d.last_seen_at > now() - interval '5 minutes') desc,
           d.last_seen_at desc nulls last;
end;
$function$;

comment on function public.os_admin_list_devices() is
  'Admin device list: per-row tier sourced from wavex_os.subscriptions (founder|growth|custom, default free). Was previously broken — queried non-existent public.subscribers.';
