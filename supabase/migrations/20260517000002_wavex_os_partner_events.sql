-- WaveX OS — partner_events table
-- Stores partner lifecycle signals (upsell triggers, activation milestones).
-- Keyed by partner_id (= Paperclip company_id for the design partner company).
--
-- event_type values:
--   partner_activation_complete  — fired when app.count >= 2 (Step 3 of onboarding)
--   (extensible: add more via check constraint update)

create table if not exists wavex_os.partner_events (
  id           uuid        primary key default gen_random_uuid(),
  partner_id   text        not null,
  event_type   text        not null,
  fired_at     timestamptz not null default now(),
  context_json jsonb       not null default '{}'::jsonb,
  created_at   timestamptz not null default now()
);

create index if not exists partner_events_partner_idx
  on wavex_os.partner_events(partner_id, fired_at desc);

create index if not exists partner_events_event_type_idx
  on wavex_os.partner_events(event_type, fired_at desc);

comment on table wavex_os.partner_events is
  'Partner lifecycle signal log. One row per emitted event. Drives upsell '
  'Telegram alerts and funnel analytics. partner_id matches the Paperclip '
  'company_id for the design-partner company.';
