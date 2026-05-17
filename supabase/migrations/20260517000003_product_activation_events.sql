-- WaveX OS — product_activation_events table
-- Tracks product-level activation funnel events for tenant companies.
-- Drives activation_rate KPI and user_activated derivation.
--
-- event_type values:
--   user_signed_up     — new user account created
--   repo_connected     — GitHub repo linked via CI webhook plugin
--   test_run_started   — CI workflow_run received (action: in_progress)
--   test_run_completed — CI workflow_run finished (action: completed)
--   user_activated     — derived: first success run within 24h of signup

create table if not exists wavex_os.product_activation_events (
  id           uuid        primary key default gen_random_uuid(),
  company_id   text        not null,
  user_id      text        not null,
  event_type   text        not null,
  occurred_at  timestamptz not null default now(),
  payload      jsonb       not null default '{}'::jsonb,
  created_at   timestamptz not null default now(),

  constraint product_activation_events_event_type_check check (
    event_type in (
      'user_signed_up',
      'repo_connected',
      'test_run_started',
      'test_run_completed',
      'user_activated'
    )
  )
);

create index if not exists product_activation_events_company_user_idx
  on wavex_os.product_activation_events(company_id, user_id, occurred_at desc);

create index if not exists product_activation_events_event_type_idx
  on wavex_os.product_activation_events(event_type, occurred_at desc);

-- Unique index prevents duplicate user_activated events per user.
create unique index if not exists product_activation_events_user_activated_once_idx
  on wavex_os.product_activation_events(company_id, user_id)
  where event_type = 'user_activated';

comment on table wavex_os.product_activation_events is
  'Product activation funnel event log. One row per emitted event. '
  'Drives activation_rate KPI and user_activated derivation. '
  'company_id matches the Paperclip company_id for the tenant company.';

-- activation_rate view for the week-of-2026-05-17 cohort
-- Usage: SELECT * FROM wavex_os.activation_rate_by_cohort_week;
create or replace view wavex_os.activation_rate_by_cohort_week as
with signups as (
  select
    company_id,
    user_id,
    date_trunc('week', occurred_at) as cohort_week,
    occurred_at as signed_up_at
  from wavex_os.product_activation_events
  where event_type = 'user_signed_up'
),
activations as (
  select
    company_id,
    user_id,
    occurred_at as activated_at,
    payload->>'hours_since_signup' as hours_since_signup
  from wavex_os.product_activation_events
  where event_type = 'user_activated'
)
select
  s.company_id,
  s.cohort_week,
  count(distinct s.user_id)                                     as signed_up,
  count(distinct a.user_id)                                     as activated,
  round(
    count(distinct a.user_id)::numeric / nullif(count(distinct s.user_id), 0) * 100,
    1
  )                                                             as activation_rate_pct,
  round(avg(a.hours_since_signup::numeric), 1)                  as avg_hours_to_activation
from signups s
left join activations a
  on a.company_id = s.company_id
  and a.user_id   = s.user_id
  and a.activated_at between s.signed_up_at and s.signed_up_at + interval '24 hours'
group by s.company_id, s.cohort_week
order by s.cohort_week desc;

comment on view wavex_os.activation_rate_by_cohort_week is
  'Weekly activation rate by signup cohort. '
  'activation_rate_pct = activated / signed_up within 24h. '
  'First target cohort: week of 2026-05-17.';
