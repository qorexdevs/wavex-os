-- WaveX OS — smoke_test_completed event instrumentation (WAVAAAA-43)
--
-- 1. Extends product_activation_events to accept smoke_test_completed events.
-- 2. Adds wavex_os.users table for signup_ts / activation_ts funnel tracking.
--
-- smoke_test_completed fires at the end of any smoke-test run (pass/fail/error).
-- On the first such event for a company, activation_ts is written to wavex_os.users
-- and is_first_run is set in the event payload.

-- ─── extend product_activation_events event_type constraint ─────────────────

alter table wavex_os.product_activation_events
  drop constraint if exists product_activation_events_event_type_check;

alter table wavex_os.product_activation_events
  add constraint product_activation_events_event_type_check check (
    event_type in (
      'user_signed_up',
      'repo_connected',
      'test_run_started',
      'test_run_completed',
      'smoke_test_completed',
      'user_activated'
    )
  );

-- Index for efficient first-run determination queries.
create index if not exists product_activation_events_smoke_test_company_idx
  on wavex_os.product_activation_events(company_id, occurred_at desc)
  where event_type = 'smoke_test_completed';

-- ─── wavex_os.users — activation funnel state per tenant company ─────────────

create table if not exists wavex_os.users (
  company_id    text        primary key,
  signup_ts     timestamptz not null default now(),
  activation_ts timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

comment on table wavex_os.users is
  'Activation funnel state per tenant company. '
  'signup_ts = first seen; '
  'activation_ts = timestamp of first smoke_test_completed event (any status).';

comment on column wavex_os.users.signup_ts is
  'Timestamp when the company first appeared in the system. '
  'Set at first smoke_test_completed event; backfill from wavex_os.subscriptions.created_at when available.';

comment on column wavex_os.users.activation_ts is
  'Timestamp of the first smoke_test_completed event for this company. '
  'Null until the first smoke test completes.';
