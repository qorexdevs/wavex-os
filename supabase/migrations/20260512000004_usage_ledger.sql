-- WaveX OS — Phase G.3.b usage ledger
--
-- Every Pool A + Pool C inference call writes one row here. The ledger is
-- the source of truth for:
--   - per-tier daily cap enforcement
--   - the $10/day global Pool A kill switch
--   - the operator dashboard's "today's cost" panel
--   - the System Reliability agent's inference_daily_burn_pct KPI
--
-- Append-only. The 30-day partition rotation lands in a future migration
-- once we have enough rows to justify it.

create table if not exists wavex_os.usage_ledger (
  id                       uuid primary key default gen_random_uuid(),
  pool                     text not null check (pool in ('A', 'C')),
  -- Pool A identifiers (anonymous)
  install_id               text,
  email                    text,
  ip_24                    text,
  -- Pool C identifiers (subscription-gated)
  subscription_id          uuid references wavex_os.subscriptions(id) on delete set null,
  -- Inference attribution
  request_id               text,
  model                    text not null,
  prompt_tokens            int not null,
  completion_tokens        int not null,
  cache_read_tokens        int not null default 0,
  cache_creation_tokens    int not null default 0,
  cost_cents               int not null,
  -- Outcome
  status                   text not null check (status in ('ok', 'rate_limited', 'error', 'cap_hit')),
  error_class              text,
  -- Audit
  ran_at                   timestamptz not null default now()
);

create index if not exists usage_ledger_pool_ran_idx
  on wavex_os.usage_ledger(pool, ran_at desc);

create index if not exists usage_ledger_pool_a_install_idx
  on wavex_os.usage_ledger(install_id, ran_at desc)
  where pool = 'A' and install_id is not null;

create index if not exists usage_ledger_pool_c_sub_idx
  on wavex_os.usage_ledger(subscription_id, ran_at desc)
  where pool = 'C' and subscription_id is not null;

create index if not exists usage_ledger_today_idx
  on wavex_os.usage_ledger(ran_at)
  where ran_at >= date_trunc('day', now() at time zone 'UTC');

comment on table wavex_os.usage_ledger is
  'Append-only ledger of every Pool A + Pool C inference call. Source of truth for daily cost caps and KPI snapshots.';

-- RLS: customer reads own (by subscription_id only — Pool A rows have no
-- customer identity). Service-role writes.
alter table wavex_os.usage_ledger enable row level security;

drop policy if exists "customer reads own usage ledger" on wavex_os.usage_ledger;
create policy "customer reads own usage ledger"
  on wavex_os.usage_ledger for select
  using (
    pool = 'C' and auth.uid() = (
      select user_id from wavex_os.subscriptions
      where id = usage_ledger.subscription_id
    )
  );

-- Platform-level helper: current pool-A burn today in cents.
create or replace function public.wavex_os_pool_a_burn_today()
returns int
language sql
security definer
set search_path = ''
as $$
  select coalesce(sum(cost_cents), 0)::int
  from wavex_os.usage_ledger
  where pool = 'A'
    and ran_at >= date_trunc('day', now() at time zone 'UTC')
    and status = 'ok';
$$;

grant execute on function public.wavex_os_pool_a_burn_today() to anon, authenticated, service_role;
