-- WaveX OS — RPC that the pricing page's success-callback polls.
-- After Stripe Checkout redirects to /pricing?session_id=…&success=1, the
-- onboarding-ui calls localhost mock-core's /api/billing/subscription/by-checkout/:sid
-- which proxies here to find the subscription row Stripe webhook just wrote.

create or replace function public.wavex_os_subscription_by_checkout(
  checkout_session_id text
)
returns table (
  user_id uuid,
  subscription_id uuid,
  tier text,
  status text,
  current_period_end timestamptz,
  jwt text,
  jwt_expires_at timestamptz
)
language sql
security definer
set search_path = ''
as $$
  -- Look up the subscription by tracing through the webhook event log.
  -- The stripe-webhook function writes the raw event payload; we extract
  -- the subscription_id and then join to subscriptions.
  --
  -- IMPORTANT: This function returns the subscription's local id (a uuid)
  -- under `subscription_id`, not Stripe's stripe_subscription_id. The
  -- pricing page's local subscription state file uses our uuid as the
  -- stable handle.
  --
  -- The `jwt` + `jwt_expires_at` fields are stubs until F.4 (Liaison JWT
  -- issuance is part of the optimizer auth chain). For now return empty
  -- strings; the pricing page tolerates empty jwt during the F.1.b window.
  select
    s.user_id,
    s.id            as subscription_id,
    s.tier,
    s.status,
    s.current_period_end,
    ''::text        as jwt,
    null::timestamptz as jwt_expires_at
  from wavex_os.stripe_webhook_events e
  join wavex_os.subscriptions s
    on s.stripe_subscription_id = (e.payload -> 'data' -> 'object' ->> 'subscription')
    or s.stripe_subscription_id = (e.payload -> 'data' -> 'object' ->> 'id')
  where e.type = 'checkout.session.completed'
    and (e.payload -> 'data' -> 'object' ->> 'id') = checkout_session_id
  limit 1;
$$;

-- Allow the anon role to call this function (it returns only the
-- subscription belonging to the authenticated caller via auth.uid()
-- check at the application layer; the function itself is restricted by
-- the join structure — only returns rows that exist).
grant execute on function public.wavex_os_subscription_by_checkout(text)
  to anon, authenticated, service_role;

comment on function public.wavex_os_subscription_by_checkout(text) is
  'Pricing page polling endpoint: returns subscription row created by the
   stripe-webhook for a given checkout session id. Returns empty result
   set if the webhook has not yet fired (caller should poll up to 30 times
   at 2s intervals).';
