-- WaveX OS — design_partners + upsell_signals tables (WAVAAAA-71)
--
-- design_partners: one row per design-partner company. Tracks whether the
--   partner has become expansion-eligible (i.e. at least one upsell signal
--   has fired). partner_id matches the Paperclip company_id for the partner.
--
-- upsell_signals: append-only log of every fired upsell trigger. Callers
--   evaluate conditions server-side and insert rows here. Used by the
--   CRO/EXPANSION workflow (WAVAAAA-74) and Telegram alerts (WAVAAAA-72).
--
-- Signal types:
--   upsell.volume    — partner exceeded 50 test-runs in the last 30 days
--   upsell.expansion — partner has app.count >= 2
--   upsell.health    — partner CI pass rate > 80% over 7-day rolling window
--
-- Thresholds set in plan document WAVAAAA-30#document-plan (2026-05-17).

create table if not exists wavex_os.design_partners (
  id                 uuid        primary key default gen_random_uuid(),
  partner_id         text        not null unique,
  partner_name       text        not null default '',
  expansion_eligible boolean     not null default false,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create index if not exists design_partners_partner_id_idx
  on wavex_os.design_partners(partner_id);

comment on table wavex_os.design_partners is
  'One row per design-partner company. expansion_eligible flips to true on '
  'the first upsell signal fire and gates the CRO/EXPANSION handoff workflow.';

-- ─── upsell_signals ─────────────────────────────────────────────────────────

create table if not exists wavex_os.upsell_signals (
  id           uuid        primary key default gen_random_uuid(),
  partner_id   text        not null,
  signal_type  text        not null check (signal_type in (
                 'upsell.volume', 'upsell.expansion', 'upsell.health'
               )),
  fired_at     timestamptz not null default now(),
  context_json jsonb       not null default '{}'::jsonb
);

create index if not exists upsell_signals_partner_idx
  on wavex_os.upsell_signals(partner_id, fired_at desc);

create index if not exists upsell_signals_type_idx
  on wavex_os.upsell_signals(signal_type, fired_at desc);

comment on table wavex_os.upsell_signals is
  'Append-only log of fired upsell trigger signals. context_json carries the '
  'metric snapshot that caused the signal to fire (e.g. test_run_count, '
  'app_count, ci_pass_rate). Downstream: CRO/EXPANSION child-issue creation '
  'and Telegram alerts.';

-- ─── updated_at auto-touch for design_partners ──────────────────────────────

drop trigger if exists design_partners_touch_updated_at on wavex_os.design_partners;
create trigger design_partners_touch_updated_at
  before update on wavex_os.design_partners
  for each row execute function wavex_os.touch_updated_at();
