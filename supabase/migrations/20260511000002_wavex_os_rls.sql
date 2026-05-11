-- WaveX OS Phase F.1 — RLS policies
--
-- Read access: customer reads own rows via JWT auth.uid()
-- Write access: ONLY service role (edge functions, stripe-webhook).
--               No anon/authenticated writes — all writes are server-mediated.

alter table wavex_os.subscriptions          enable row level security;
alter table wavex_os.injection_queue        enable row level security;
alter table wavex_os.optimizer_runs         enable row level security;
alter table wavex_os.fleet_digests          enable row level security;
alter table wavex_os.stripe_webhook_events  enable row level security;

-- subscriptions: customer can read their own subscription
drop policy if exists "customer reads own subscription" on wavex_os.subscriptions;
create policy "customer reads own subscription"
  on wavex_os.subscriptions for select
  using (auth.uid() = user_id);

-- injection_queue: customer can read their pending injections (the Liaison agent uses this)
drop policy if exists "customer reads own pending injections" on wavex_os.injection_queue;
create policy "customer reads own pending injections"
  on wavex_os.injection_queue for select
  using (
    auth.uid() = (
      select user_id from wavex_os.subscriptions
      where id = injection_queue.subscription_id
    )
  );

-- injection_queue: customer can mark their injections consumed (one-way update only)
drop policy if exists "customer marks own injection consumed" on wavex_os.injection_queue;
create policy "customer marks own injection consumed"
  on wavex_os.injection_queue for update
  using (
    auth.uid() = (
      select user_id from wavex_os.subscriptions
      where id = injection_queue.subscription_id
    )
    and consumed_at is null
  )
  with check (consumed_at is not null);

-- optimizer_runs: customer can read their own audit log (transparency on what we spent on them)
drop policy if exists "customer reads own optimizer runs" on wavex_os.optimizer_runs;
create policy "customer reads own optimizer runs"
  on wavex_os.optimizer_runs for select
  using (
    auth.uid() = (
      select user_id from wavex_os.subscriptions
      where id = optimizer_runs.subscription_id
    )
  );

-- fleet_digests: customer can read+insert their own (uploads happen client-side via Liaison)
drop policy if exists "customer reads own fleet digests" on wavex_os.fleet_digests;
create policy "customer reads own fleet digests"
  on wavex_os.fleet_digests for select
  using (
    auth.uid() = (
      select user_id from wavex_os.subscriptions
      where id = fleet_digests.subscription_id
    )
  );

drop policy if exists "customer inserts own fleet digest" on wavex_os.fleet_digests;
create policy "customer inserts own fleet digest"
  on wavex_os.fleet_digests for insert
  with check (
    auth.uid() = (
      select user_id from wavex_os.subscriptions
      where id = fleet_digests.subscription_id
    )
  );

-- stripe_webhook_events: service_role only (no client access)
-- (no policies = no access for anon/authenticated; service_role bypasses RLS)
