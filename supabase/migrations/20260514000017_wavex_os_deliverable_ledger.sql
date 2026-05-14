-- Phase 6 / OPERATIONAL_LAYER.md §1-2 — the unified accountability record.
-- One row per unit of agent work: plan_ref -> expected_response ->
-- assigned_agent -> artifacts -> token_cost -> status. Mutable lifecycle
-- (open -> in_progress -> delivered -> verified). Economics are in TOKENS.

create table wavex_os.deliverable_ledger (
  id                    uuid primary key default gen_random_uuid(),
  device_id             uuid not null references wavex_os.os_devices(id) on delete cascade,
  subscription_id       uuid references wavex_os.subscriptions(id) on delete set null,
  plan_ref              text,                       -- the plan / roadmap item / injection this serves
  issue_id              text,                       -- local Paperclip issue id/key
  expected_response     text,                       -- the contract: what "done" means
  assigned_agent        text,                       -- accountable agent (local slot or expert catalog_id)
  contributing_agents   jsonb not null default '[]'::jsonb,
  kind                  text not null default 'directive'
                          check (kind in ('directive','code_change','db_migration','routine')),
  artifacts             jsonb not null default '{}'::jsonb,  -- commit SHAs, PR url, migration file, comment refs
  tokens_in             bigint not null default 0,
  tokens_out            bigint not null default 0,
  tokens_cache          bigint not null default 0,
  status                text not null default 'open'
                          check (status in ('open','in_progress','delivered','verified','failed')),
  opened_at             timestamptz not null default now(),
  delivered_at          timestamptz,
  verified_at           timestamptz,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

comment on table wavex_os.deliverable_ledger is
  'OPERATIONAL_LAYER.md §1 — unified accountability record, one row per unit of agent work. Mutable: the Liaison upserts on (device_id, issue_id) as a deliverable progresses. Economics tracked in tokens (tokens_in/out/cache), never USD.';

-- The Liaison upserts per local issue — one deliverable per (device, issue).
create unique index deliverable_ledger_device_issue_idx
  on wavex_os.deliverable_ledger (device_id, issue_id)
  where issue_id is not null;
create index deliverable_ledger_subscription_idx
  on wavex_os.deliverable_ledger (subscription_id);
create index deliverable_ledger_status_idx
  on wavex_os.deliverable_ledger (status, updated_at desc);
create index deliverable_ledger_agent_idx
  on wavex_os.deliverable_ledger (assigned_agent);

alter table wavex_os.deliverable_ledger enable row level security;

create policy "customer reads own deliverable ledger"
  on wavex_os.deliverable_ledger for select
  using (device_id in (select id from wavex_os.os_devices where user_id = auth.uid()));

create policy "customer inserts own deliverable ledger"
  on wavex_os.deliverable_ledger for insert
  with check (device_id in (select id from wavex_os.os_devices where user_id = auth.uid()));

-- Mutable lifecycle — the Liaison updates its own rows as deliverables progress.
create policy "customer updates own deliverable ledger"
  on wavex_os.deliverable_ledger for update
  using (device_id in (select id from wavex_os.os_devices where user_id = auth.uid()))
  with check (device_id in (select id from wavex_os.os_devices where user_id = auth.uid()));

create policy "operator reads all deliverable ledger"
  on wavex_os.deliverable_ledger for select
  using (public.has_role(auth.uid(), 'admin'::public.app_role));

-- Phase 6 §2 — usage_ledger gains deliverable + agent attribution so token
-- spend rolls up per deliverable / per agent. Hub-routed inference is
-- self-accounting; these columns are how it attributes.
alter table wavex_os.usage_ledger
  add column deliverable_id uuid references wavex_os.deliverable_ledger(id) on delete set null,
  add column agent_id       text;

create index usage_ledger_deliverable_idx on wavex_os.usage_ledger (deliverable_id);
create index usage_ledger_agent_idx on wavex_os.usage_ledger (agent_id);

comment on column wavex_os.usage_ledger.deliverable_id is
  'OPERATIONAL_LAYER.md §2 — attributes this inference call to a deliverable_ledger row, so token spend rolls up per deliverable.';
comment on column wavex_os.usage_ledger.agent_id is
  'OPERATIONAL_LAYER.md §2 — the agent (local slot or expert catalog_id) whose work this inference call served.';
