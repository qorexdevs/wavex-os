-- WaveX OS — auth_events table
-- Tracks signup events with UTM attribution so blog campaign performance can be measured.
--
-- Measurement query (used by smoke-test-guide-may2026 campaign):
--   SELECT COUNT(DISTINCT user_id) AS new_auth_users
--   FROM auth_events
--   WHERE created_at >= CURRENT_TIMESTAMP - INTERVAL '7 days'
--     AND utm_campaign = 'smoke-test-guide-may2026'
--     AND event_type = 'signup_confirmed';

create table if not exists wavex_os.auth_events (
  id           uuid        primary key default gen_random_uuid(),
  user_id      text        not null,
  email        text,
  event_type   text        not null,
  utm_campaign text,
  utm_source   text,
  ref          text,
  resend_fired boolean     not null default false,
  created_at   timestamptz not null default now()
);

create index if not exists auth_events_user_id_idx
  on wavex_os.auth_events(user_id, created_at desc);

create index if not exists auth_events_utm_campaign_idx
  on wavex_os.auth_events(utm_campaign, event_type, created_at desc)
  where utm_campaign is not null;

-- Idempotent: prevent duplicate signup_confirmed rows for the same user+campaign.
create unique index if not exists auth_events_user_campaign_signup_once_idx
  on wavex_os.auth_events(user_id, utm_campaign)
  where event_type = 'signup_confirmed' and utm_campaign is not null;

comment on table wavex_os.auth_events is
  'Auth signup events with UTM attribution. '
  'resend_fired=true when the Resend audience contact was created for the campaign. '
  'Use utm_campaign + event_type=signup_confirmed to measure blog campaign conversions.';
