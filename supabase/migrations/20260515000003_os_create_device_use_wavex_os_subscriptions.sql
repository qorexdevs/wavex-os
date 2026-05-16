-- os_create_device previously queried public.subscribers (a WaveX Experiences
-- legacy table that doesn't exist in this project). Every device-pair attempt
-- 500'd with:  relation "public.subscribers" does not exist
--
-- Rewrite the RPC to query wavex_os.subscriptions with real wavex-os tiers
-- (founder | growth | custom) and ACTIVE_STATUSES (trialing|active|past_due).
-- Default tier when no subscription row exists is 'free' → 1 device, so an
-- unpaid customer can still pair (the inference call itself is subscription-
-- gated downstream by the Realtime worker via wavex_os_subscription_lookup_by_user).

create or replace function public.os_create_device(
  _user_id uuid,
  _name text,
  _kind text,
  _hostname text,
  _os_version text
)
returns table (id uuid, name text)
language plpgsql
security definer
set search_path to 'public', 'wavex_os'
as $function$
declare
  _id uuid;
  _name_out text;
  _tier text;
  _limit int;
  _active int;
begin
  select coalesce(s.tier::text, 'free')
    into _tier
    from wavex_os.subscriptions s
   where s.user_id = _user_id
     and s.status in ('active', 'trialing', 'past_due')
   order by s.current_period_end desc nulls last,
            s.updated_at         desc nulls last,
            s.created_at         desc nulls last
   limit 1;
  _tier := coalesce(_tier, 'free');

  _limit := case _tier
    when 'founder' then 1
    when 'growth'  then 5
    when 'custom'  then 99
    else 1
  end;

  select count(*) into _active
    from wavex_os.os_devices
   where user_id = _user_id and status <> 'revoked';

  if _active >= _limit then
    raise exception 'device_limit_reached:%/%', _active, _limit;
  end if;

  insert into wavex_os.os_devices(user_id, name, kind, hostname, os_version, last_seen_at)
       values (_user_id, _name, _kind, _hostname, _os_version, now())
  returning wavex_os.os_devices.id, wavex_os.os_devices.name
       into _id, _name_out;
  return query select _id, _name_out;
end;
$function$;

comment on function public.os_create_device(uuid, text, text, text, text) is
  'Device-pair creator: per-user tier-aware device limit. Sources tier from wavex_os.subscriptions (founder=1, growth=5, custom=99, free=1). Was previously broken — queried non-existent public.subscribers.';
