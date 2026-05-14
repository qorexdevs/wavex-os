-- Phase 1 / REDUNDANCY_ARCHITECTURE.md §"instance_health"
-- Liaison-pushed health snapshot of a customer's local Paperclip fleet.
-- Append-only; latest row per device = current state. The cloud watchdog +
-- operator console read this; the cloud cannot reach the customer's localhost.

create table wavex_os.instance_health (
  id                     uuid primary key default gen_random_uuid(),
  device_id              uuid not null references wavex_os.os_devices(id) on delete cascade,
  subscription_id        uuid references wavex_os.subscriptions(id) on delete set null,
  tier                   text not null default 'pool_a' check (tier in ('pool_a','pool_b')),
  reported_at            timestamptz not null default now(),
  paperclip_reachable    boolean not null default false,
  paperclip_version      text,
  agent_count            int not null default 0,
  agents_idle            int not null default 0,
  agents_running         int not null default 0,
  agents_error           int not null default 0,
  runs_last_hour         int not null default 0,
  runs_failed_last_hour  int not null default 0,
  last_heartbeat_at      timestamptz,
  recent_errors          jsonb not null default '[]'::jsonb,
  fleet_status           text not null default 'down' check (fleet_status in ('healthy','degraded','down')),
  created_at             timestamptz not null default now()
);

comment on table wavex_os.instance_health is
  'Liaison-pushed health snapshot of a customer''s local Paperclip fleet. Append-only, one row per push (~5min paid / ~30min free); latest row per device = current state. subscription_id added beyond the design doc so the operator console can filter paid fleets without a device->user->sub join.';

create index instance_health_device_reported_idx
  on wavex_os.instance_health (device_id, reported_at desc);
create index instance_health_subscription_idx
  on wavex_os.instance_health (subscription_id);
-- partial index: the operator console's "fleets needing attention" query
create index instance_health_attention_idx
  on wavex_os.instance_health (reported_at desc)
  where fleet_status <> 'healthy';

alter table wavex_os.instance_health enable row level security;

-- Customer (Liaison authenticates as the customer's Supabase user, same as
-- fleet_digests) reads + inserts only its own devices' health.
create policy "customer reads own instance health"
  on wavex_os.instance_health for select
  using (device_id in (select id from wavex_os.os_devices where user_id = auth.uid()));

create policy "customer inserts own instance health"
  on wavex_os.instance_health for insert
  with check (device_id in (select id from wavex_os.os_devices where user_id = auth.uid()));

-- Operator console: admins read every fleet's health.
create policy "operator reads all instance health"
  on wavex_os.instance_health for select
  using (public.has_role(auth.uid(), 'admin'::public.app_role));
