-- WaveX OS — wizard_events table (WAVAAAA-124)
--
-- Tracks the 5 wizard telemetry events for KPI measurement:
--   wizard_start         — { user_id, ts }
--   wizard_step_complete — { user_id, step: 1|2|3, ts }
--   wizard_abandon       — { user_id, last_step, ts }
--   wizard_complete      — { user_id, ts }
--   first_test_result    — { user_id, result_id, status, ts }
--
-- KPI derivations:
--   ttv_hours       = (first_test_result.ts - wizard_start.ts) / 3600
--   activation_rate = count(wizard_complete) / count(wizard_start) per cohort-week

create table if not exists wavex_os.wizard_events (
  id          uuid        primary key default gen_random_uuid(),
  user_id     text        not null,
  event_type  text        not null check (event_type in (
                'wizard_start', 'wizard_step_complete', 'wizard_abandon',
                'wizard_complete', 'first_test_result'
              )),
  step        integer,
  last_step   integer,
  result_id   text,
  status      text,
  created_at  timestamptz not null default now()
);

create index if not exists wizard_events_user_event_idx
  on wavex_os.wizard_events(user_id, event_type, created_at desc);

create index if not exists wizard_events_event_type_idx
  on wavex_os.wizard_events(event_type, created_at desc);

comment on table wavex_os.wizard_events is
  'Wizard funnel telemetry. Append-only log of the 5 event types fired by '
  'WavexOsOnboarding.tsx. Used to compute ttv_hours (first_test_result − '
  'wizard_start) and weekly activation_rate cohorts. See GET /api/wizard-metrics.';
