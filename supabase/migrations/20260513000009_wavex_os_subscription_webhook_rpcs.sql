-- Public-schema RPC surface for wavex-os-subscription-webhook (F.1/F.4).
-- PostgREST only exposes public/graphql_public/meta_ads — wavex_os is private.
-- These RPCs bridge that without touching project-level schema exposure.

create or replace function public.wavex_os_subscription_upsert(
  p_user_id uuid,
  p_stripe_customer_id text,
  p_stripe_subscription_id text,
  p_tier text,
  p_status text,
  p_current_period_start timestamptz,
  p_current_period_end timestamptz,
  p_trial_end timestamptz,
  p_cancel_at_period_end boolean,
  p_canceled_at timestamptz,
  p_metadata jsonb
) returns table (id uuid, status text)
language plpgsql
security definer
set search_path = wavex_os, public
as $$
declare
  v_user_id uuid := p_user_id;
  v_row wavex_os.subscriptions%rowtype;
begin
  if v_user_id is null then
    select user_id into v_user_id
      from wavex_os.subscriptions
      where stripe_subscription_id = p_stripe_subscription_id
      limit 1;
  end if;

  if v_user_id is null then
    raise notice 'wavex_os_subscription_upsert: no user_id for stripe_sub %', p_stripe_subscription_id;
    return;
  end if;

  insert into wavex_os.subscriptions (
    user_id, stripe_customer_id, stripe_subscription_id,
    tier, status, current_period_start, current_period_end,
    trial_end, cancel_at_period_end, canceled_at, metadata
  ) values (
    v_user_id, p_stripe_customer_id, p_stripe_subscription_id,
    p_tier, p_status, p_current_period_start, p_current_period_end,
    p_trial_end, coalesce(p_cancel_at_period_end, false), p_canceled_at, coalesce(p_metadata, '{}'::jsonb)
  )
  on conflict (stripe_subscription_id) do update set
    stripe_customer_id   = excluded.stripe_customer_id,
    tier                 = excluded.tier,
    status               = excluded.status,
    current_period_start = excluded.current_period_start,
    current_period_end   = excluded.current_period_end,
    trial_end            = excluded.trial_end,
    cancel_at_period_end = excluded.cancel_at_period_end,
    canceled_at          = excluded.canceled_at,
    metadata             = excluded.metadata,
    updated_at           = now()
  returning * into v_row;

  return query select v_row.id, v_row.status;
end;
$$;

create or replace function public.wavex_os_subscription_mark_canceled(
  p_stripe_subscription_id text,
  p_canceled_at timestamptz,
  p_cancel_at_period_end boolean
) returns void
language sql
security definer
set search_path = wavex_os, public
as $$
  update wavex_os.subscriptions
     set status = 'canceled',
         canceled_at = coalesce(p_canceled_at, now()),
         cancel_at_period_end = coalesce(p_cancel_at_period_end, false),
         updated_at = now()
   where stripe_subscription_id = p_stripe_subscription_id;
$$;

create or replace function public.wavex_os_subscription_mark_past_due(
  p_stripe_subscription_id text
) returns void
language sql
security definer
set search_path = wavex_os, public
as $$
  update wavex_os.subscriptions
     set status = 'past_due',
         updated_at = now()
   where stripe_subscription_id = p_stripe_subscription_id;
$$;

revoke all on function public.wavex_os_subscription_upsert(uuid, text, text, text, text, timestamptz, timestamptz, timestamptz, boolean, timestamptz, jsonb) from public;
revoke all on function public.wavex_os_subscription_mark_canceled(text, timestamptz, boolean) from public;
revoke all on function public.wavex_os_subscription_mark_past_due(text) from public;
grant execute on function public.wavex_os_subscription_upsert(uuid, text, text, text, text, timestamptz, timestamptz, timestamptz, boolean, timestamptz, jsonb) to service_role;
grant execute on function public.wavex_os_subscription_mark_canceled(text, timestamptz, boolean) to service_role;
grant execute on function public.wavex_os_subscription_mark_past_due(text) to service_role;

comment on function public.wavex_os_subscription_upsert is
  'Edge-function-callable bridge for wavex-os-subscription-webhook. Handles checkout.session.completed + customer.subscription.* upserts. Auto-resolves user_id from existing row when p_user_id is null.';
