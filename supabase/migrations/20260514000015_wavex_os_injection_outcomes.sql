-- Phase 1 / REDUNDANCY_ARCHITECTURE.md §"injection_outcomes"
-- Closes the loop on the prompt-injection promise: injection_queue_v2 only
-- knows an injection was *consumed*; this knows whether the fleet *acted* on
-- it and whether the target_kpi moved. Append-only observation log; latest
-- row per injection_id = current outcome.

create table wavex_os.injection_outcomes (
  id               uuid primary key default gen_random_uuid(),
  injection_id     uuid not null references wavex_os.injection_queue_v2(id) on delete cascade,
  device_id        uuid not null references wavex_os.os_devices(id) on delete cascade,
  subscription_id  uuid references wavex_os.subscriptions(id) on delete set null,
  observed_at      timestamptz not null default now(),
  acted            boolean not null default false,
  outcome          text not null check (outcome in ('delivered_acted','delivered_ignored','delivered_failed','not_delivered')),
  evidence         jsonb not null default '{}'::jsonb,
  target_kpi       text,
  kpi_before       numeric,
  kpi_after        numeric,
  delivery_score   numeric(3,2) check (delivery_score is null or (delivery_score >= 0 and delivery_score <= 1)),
  created_at       timestamptz not null default now()
);

comment on table wavex_os.injection_outcomes is
  'Liaison-pushed observation of what the local fleet did with a consumed injection (REDUNDANCY_ARCHITECTURE.md). Append-only; latest row per injection_id = current outcome. subscription_id added beyond the design doc for operator cross-fleet filtering.';

create index injection_outcomes_injection_idx
  on wavex_os.injection_outcomes (injection_id, observed_at desc);
create index injection_outcomes_device_observed_idx
  on wavex_os.injection_outcomes (device_id, observed_at desc);
create index injection_outcomes_subscription_idx
  on wavex_os.injection_outcomes (subscription_id);

alter table wavex_os.injection_outcomes enable row level security;

create policy "customer reads own injection outcomes"
  on wavex_os.injection_outcomes for select
  using (device_id in (select id from wavex_os.os_devices where user_id = auth.uid()));

create policy "customer inserts own injection outcomes"
  on wavex_os.injection_outcomes for insert
  with check (device_id in (select id from wavex_os.os_devices where user_id = auth.uid()));

create policy "operator reads all injection outcomes"
  on wavex_os.injection_outcomes for select
  using (public.has_role(auth.uid(), 'admin'::public.app_role));
