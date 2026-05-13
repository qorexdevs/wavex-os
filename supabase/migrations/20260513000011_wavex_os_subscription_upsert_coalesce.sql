-- Defensive UPDATE: never clobber a previously-good current_period_* with null.
--
-- Stripe sometimes fires customer.subscription.created BEFORE current_period_*
-- is populated on the root sub object (it relies on items[0] for the new
-- 2025-09 API). Even with the webhook reading items[0] as fallback, a later
-- update event may legitimately arrive with null current_period_* on both
-- root AND items (e.g. a partial customer.subscription.updated emitted
-- during a price change). The original UPDATE used `excluded.current_period_*`
-- unconditionally, which would clobber valid existing data with null and
-- violate the NOT NULL constraint — producing the error observed on
-- evt_1TWf673IuKBdXit2rxPmeQAw at 2026-05-13T15:53:23.502Z.
--
-- Fix: COALESCE every column on the UPDATE path so partial events never
-- erase known-good values. The INSERT path remains strict (the webhook
-- function enforces NOT NULL pre-RPC). Metadata uses jsonb merge (||) so
-- partial metadata updates accumulate instead of overwriting.
CREATE OR REPLACE FUNCTION public.wavex_os_subscription_upsert(
  p_user_id uuid,
  p_stripe_customer_id text,
  p_stripe_subscription_id text,
  p_tier text,
  p_status text,
  p_current_period_start timestamp with time zone,
  p_current_period_end timestamp with time zone,
  p_trial_end timestamp with time zone,
  p_cancel_at_period_end boolean,
  p_canceled_at timestamp with time zone,
  p_metadata jsonb
)
RETURNS TABLE(id uuid, status text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'wavex_os', 'public'
AS $function$
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
    stripe_customer_id   = coalesce(excluded.stripe_customer_id, wavex_os.subscriptions.stripe_customer_id),
    tier                 = coalesce(excluded.tier, wavex_os.subscriptions.tier),
    status               = coalesce(excluded.status, wavex_os.subscriptions.status),
    current_period_start = coalesce(excluded.current_period_start, wavex_os.subscriptions.current_period_start),
    current_period_end   = coalesce(excluded.current_period_end, wavex_os.subscriptions.current_period_end),
    trial_end            = coalesce(excluded.trial_end, wavex_os.subscriptions.trial_end),
    cancel_at_period_end = coalesce(excluded.cancel_at_period_end, wavex_os.subscriptions.cancel_at_period_end),
    canceled_at          = coalesce(excluded.canceled_at, wavex_os.subscriptions.canceled_at),
    metadata             = wavex_os.subscriptions.metadata || coalesce(excluded.metadata, '{}'::jsonb),
    updated_at           = now()
  returning * into v_row;

  return query select v_row.id, v_row.status;
end;
$function$;
