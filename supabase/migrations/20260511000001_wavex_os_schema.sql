-- WaveX OS Phase F.1 — billing + cross-tenant injection schema
-- Namespaced under wavex_os.* to avoid collision with the WaveX concierge
-- product's tables in public.* (which already has its own subscriptions,
-- stripe_webhook_events, etc. for a different product).
--
-- Tables:
--   wavex_os.subscriptions       — Stripe-backed sub state, one row per active sub
--   wavex_os.injection_queue     — server-built injections waiting for Liaison pull
--   wavex_os.optimizer_runs      — audit log of Pool C inference calls
--   wavex_os.fleet_digests       — customer-uploaded fleet state for optimizer context
--   wavex_os.stripe_webhook_events — idempotent webhook event log

create schema if not exists wavex_os;
comment on schema wavex_os is 'WaveX OS Phase F — billing, optimizer queue, and cross-tenant injection tables. Distinct from the WaveX concierge product (which lives in public).';

-- ─── subscriptions ──────────────────────────────────────────────────────
create table if not exists wavex_os.subscriptions (
  id                        uuid primary key default gen_random_uuid(),
  user_id                   uuid not null references auth.users(id) on delete cascade,
  stripe_customer_id        text not null unique,
  stripe_subscription_id    text not null unique,
  tier                      text not null check (tier in ('founder', 'growth', 'custom')),
  status                    text not null check (status in (
    'trialing', 'active', 'past_due', 'canceled', 'unpaid', 'incomplete',
    'incomplete_expired', 'paused'
  )),
  current_period_start      timestamptz not null,
  current_period_end        timestamptz not null,
  trial_end                 timestamptz,
  cancel_at_period_end      boolean not null default false,
  canceled_at               timestamptz,
  metadata                  jsonb not null default '{}'::jsonb,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now()
);
create index if not exists subscriptions_user_id_idx on wavex_os.subscriptions(user_id);
create index if not exists subscriptions_status_idx on wavex_os.subscriptions(status) where status in ('trialing','active');
comment on table wavex_os.subscriptions is 'Stripe-backed subscription state for WaveX OS Phase F optimizer access. One row per Stripe subscription. status mirrors Stripe except paused which we use locally.';

-- ─── injection_queue ────────────────────────────────────────────────────
create table if not exists wavex_os.injection_queue (
  id                        uuid primary key default gen_random_uuid(),
  subscription_id           uuid not null references wavex_os.subscriptions(id) on delete cascade,
  kind                      text not null check (kind in (
    'board_nudge', 'workflow_optimization', 'error_recovery',
    'alignment_correction', 'concierge_response'
  )),
  payload                   jsonb not null,
  signature                 text not null,
  generated_by_run_id       uuid,
  consumed_at               timestamptz,
  consumed_by_liaison_id    text,
  expires_at                timestamptz not null default (now() + interval '72 hours'),
  created_at                timestamptz not null default now()
);
create index if not exists injection_queue_sub_pending_idx on wavex_os.injection_queue(subscription_id, created_at) where consumed_at is null;
create index if not exists injection_queue_expires_idx on wavex_os.injection_queue(expires_at) where consumed_at is null;
comment on table wavex_os.injection_queue is 'Server-generated injections waiting for the customer''s Liaison agent to pull. payload is the body the Liaison posts to local Paperclip. signature is ed25519 over canonical JSON.';

-- ─── optimizer_runs ─────────────────────────────────────────────────────
create table if not exists wavex_os.optimizer_runs (
  id                        uuid primary key default gen_random_uuid(),
  subscription_id           uuid not null references wavex_os.subscriptions(id) on delete cascade,
  kind                      text not null,
  model                     text not null,
  prompt_tokens             int not null,
  completion_tokens         int not null,
  cache_read_tokens         int not null default 0,
  cache_creation_tokens     int not null default 0,
  cost_cents                int not null,
  injections_generated      int not null default 0,
  status                    text not null check (status in ('ok', 'error', 'rate_limited')),
  error                     text,
  ran_at                    timestamptz not null default now()
);
create index if not exists optimizer_runs_sub_ran_idx on wavex_os.optimizer_runs(subscription_id, ran_at desc);
comment on table wavex_os.optimizer_runs is 'Audit log of every Pool C inference call. Used for per-subscription cost tracking and abuse detection. cost_cents includes our margin assumptions, not raw API cost.';

-- ─── fleet_digests ──────────────────────────────────────────────────────
create table if not exists wavex_os.fleet_digests (
  id                        uuid primary key default gen_random_uuid(),
  subscription_id           uuid not null references wavex_os.subscriptions(id) on delete cascade,
  digest                    jsonb not null,
  digest_hash               text not null,
  redaction_policy          text not null default 'full' check (redaction_policy in ('full','hash_only','redacted')),
  received_at               timestamptz not null default now()
);
create index if not exists fleet_digests_sub_received_idx on wavex_os.fleet_digests(subscription_id, received_at desc);
create unique index if not exists fleet_digests_dedup_idx on wavex_os.fleet_digests(subscription_id, digest_hash);
comment on table wavex_os.fleet_digests is 'Customer-uploaded fleet state (KPIs + recent issues + agent status) that the optimizer reads to generate injection content. redaction_policy is operator-controlled.';

-- ─── stripe_webhook_events (idempotency) ────────────────────────────────
create table if not exists wavex_os.stripe_webhook_events (
  id                        text primary key,            -- Stripe event id (evt_*)
  type                      text not null,
  api_version               text,
  payload                   jsonb not null,
  processed_at              timestamptz not null default now(),
  processing_error          text
);
comment on table wavex_os.stripe_webhook_events is 'Idempotency log for Stripe webhook events. Insert with id=event.id; ON CONFLICT DO NOTHING to skip duplicates.';

-- ─── updated_at auto-touch ──────────────────────────────────────────────
create or replace function wavex_os.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists subscriptions_touch_updated_at on wavex_os.subscriptions;
create trigger subscriptions_touch_updated_at
  before update on wavex_os.subscriptions
  for each row execute function wavex_os.touch_updated_at();
