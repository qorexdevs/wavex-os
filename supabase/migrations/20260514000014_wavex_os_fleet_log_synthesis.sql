-- Phase 1 / REDUNDANCY_ARCHITECTURE.md §"fleet_log_synthesis" + OPERATIONAL_LAYER.md §3
-- The "4h instance check": the Liaison runs a claude pass over the local
-- Paperclip run logs and pushes a synthesis — "are the agents doing the right
-- job". Append-only; latest row per device = current synthesis.

create table wavex_os.fleet_log_synthesis (
  id                   uuid primary key default gen_random_uuid(),
  device_id            uuid not null references wavex_os.os_devices(id) on delete cascade,
  subscription_id      uuid references wavex_os.subscriptions(id) on delete set null,
  synthesized_at       timestamptz not null default now(),
  window_hours         int not null default 4,
  runs_total           int not null default 0,
  runs_ok              int not null default 0,
  runs_failed          int not null default 0,
  runs_timeout         int not null default 0,
  agents_silent        jsonb not null default '[]'::jsonb,
  effectiveness_score  numeric(3,2) check (effectiveness_score is null or (effectiveness_score >= 0 and effectiveness_score <= 1)),
  summary              text,
  flags                jsonb not null default '[]'::jsonb,
  created_at           timestamptz not null default now()
);

comment on table wavex_os.fleet_log_synthesis is
  'Liaison-pushed 4h synthesis of the local fleet''s run logs (OPERATIONAL_LAYER.md §3). effectiveness_score 0..1; summary is a human-readable paragraph; flags = [{severity, agent_id, note}]. subscription_id added beyond the design doc for operator cross-fleet filtering.';

create index fleet_log_synthesis_device_synth_idx
  on wavex_os.fleet_log_synthesis (device_id, synthesized_at desc);
create index fleet_log_synthesis_subscription_idx
  on wavex_os.fleet_log_synthesis (subscription_id);

alter table wavex_os.fleet_log_synthesis enable row level security;

create policy "customer reads own fleet log synthesis"
  on wavex_os.fleet_log_synthesis for select
  using (device_id in (select id from wavex_os.os_devices where user_id = auth.uid()));

create policy "customer inserts own fleet log synthesis"
  on wavex_os.fleet_log_synthesis for insert
  with check (device_id in (select id from wavex_os.os_devices where user_id = auth.uid()));

create policy "operator reads all fleet log synthesis"
  on wavex_os.fleet_log_synthesis for select
  using (public.has_role(auth.uid(), 'admin'::public.app_role));
