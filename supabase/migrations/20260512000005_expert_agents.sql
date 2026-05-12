-- WaveX OS — F.4.a — Expert Agent catalog + per-customer hires + audit log
-- + field_envelopes on fleet_digests for agent-scoped encryption.
--
-- Design rationale: docs/PRIVACY_ARCHITECTURE.md. Tier 2 (paid) data flows
-- to WaveX only as far as the specific Expert Agent the customer hired,
-- encrypted to that agent's public key, with every read audit-logged.

-- ─── expert_agent_catalog ────────────────────────────────────────────
-- The list of WaveX Expert Agents customers can hire. Edited by the
-- WaveX team via direct DB updates (or a future admin tool). NOT
-- customer-editable.
create table if not exists wavex_os.expert_agent_catalog (
  id                       text primary key,
  display_name             text not null,
  purpose                  text not null,
  data_scope               text[] not null,
  output_types             text[] not null,
  required_tier            text not null check (required_tier in ('founder','growth','custom')),
  daily_token_cap          int not null,
  prompt_template_path     text not null,
  -- Public half of the X25519 keypair. Private half lives ONLY in the
  -- server-side worker for this catalog id (in the operator's Mac
  -- Keychain), NEVER stored in Supabase.
  recipient_public_key     bytea,
  is_active                boolean not null default true,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);
comment on table wavex_os.expert_agent_catalog is
  'The catalog of WaveX Expert Agents a customer can hire. Edited by WaveX team only. data_scope and output_types define what the agent can read and write — they are the contract the customer agrees to at hire-time.';

drop trigger if exists expert_agent_catalog_touch_updated_at on wavex_os.expert_agent_catalog;
create trigger expert_agent_catalog_touch_updated_at
  before update on wavex_os.expert_agent_catalog
  for each row execute function wavex_os.touch_updated_at();

-- ─── hired_expert_agents ─────────────────────────────────────────────
-- The customer's instantiation: one row per (subscription, catalog_id)
-- pair. Status='active' means the customer has consented to the
-- Processing Agreement and the agent is currently allowed to read
-- field_envelopes addressed to it.
create table if not exists wavex_os.hired_expert_agents (
  id                       uuid primary key default gen_random_uuid(),
  subscription_id          uuid not null references wavex_os.subscriptions(id) on delete cascade,
  catalog_id               text not null references wavex_os.expert_agent_catalog(id),
  status                   text not null default 'active' check (status in ('active','paused','revoked')),
  hired_at                 timestamptz not null default now(),
  revoked_at               timestamptz,
  -- The Processing Agreement version the customer accepted. We bump
  -- the version when terms change; existing hires must re-consent.
  agreement_version        text not null,
  agreement_accepted_at    timestamptz not null default now(),
  unique (subscription_id, catalog_id)
);
create index if not exists hired_expert_agents_sub_idx
  on wavex_os.hired_expert_agents(subscription_id)
  where status = 'active';
comment on table wavex_os.hired_expert_agents is
  'One row per (subscription, catalog_id). Status active = customer consented and agent may read fields scoped to it. Revoked rows kept for audit.';

-- ─── digest_access_log ───────────────────────────────────────────────
-- Every server-side decrypt writes one row here. Customer reads via RLS
-- (transparency).
create table if not exists wavex_os.digest_access_log (
  id                       uuid primary key default gen_random_uuid(),
  hired_agent_id           uuid not null references wavex_os.hired_expert_agents(id) on delete cascade,
  digest_id                uuid references wavex_os.fleet_digests(id) on delete set null,
  fields_accessed          text[] not null,
  purpose                  text not null,
  request_id               text,
  accessed_at              timestamptz not null default now()
);
create index if not exists digest_access_log_hired_idx
  on wavex_os.digest_access_log(hired_agent_id, accessed_at desc);
comment on table wavex_os.digest_access_log is
  'Audit row written by each server-side Expert Agent worker every time it decrypts and reads a fleet_digest. Customer-visible via RLS.';

-- ─── fleet_digests: add field_envelopes + ttl_at ─────────────────────
alter table wavex_os.fleet_digests
  add column if not exists field_envelopes jsonb,
  add column if not exists ttl_at timestamptz default (now() + interval '24 hours');

create index if not exists fleet_digests_ttl_idx
  on wavex_os.fleet_digests(ttl_at)
  where ttl_at is not null;

comment on column wavex_os.fleet_digests.field_envelopes is
  'Per-field libsodium sealed-box envelopes. Shape: {<field_name>: {recipients: [<catalog_id>], ciphertext: <base64>}}. Plaintext only exists on the customer Mac.';

comment on column wavex_os.fleet_digests.ttl_at is
  '24h auto-delete deadline. Rows past this should be purged by the platform cleanup cron (lands with F.5).';

-- ─── RLS policies ────────────────────────────────────────────────────
alter table wavex_os.expert_agent_catalog enable row level security;
alter table wavex_os.hired_expert_agents enable row level security;
alter table wavex_os.digest_access_log    enable row level security;

-- expert_agent_catalog: anyone (anon + authenticated) reads active rows.
-- Only service_role writes.
drop policy if exists "everyone reads active catalog" on wavex_os.expert_agent_catalog;
create policy "everyone reads active catalog"
  on wavex_os.expert_agent_catalog for select
  using (is_active = true);

-- hired_expert_agents: customer reads own hires.
drop policy if exists "customer reads own hires" on wavex_os.hired_expert_agents;
create policy "customer reads own hires"
  on wavex_os.hired_expert_agents for select
  using (
    auth.uid() = (
      select user_id from wavex_os.subscriptions
      where id = hired_expert_agents.subscription_id
    )
  );

-- hired_expert_agents: customer can revoke (status → revoked).
drop policy if exists "customer revokes own hire" on wavex_os.hired_expert_agents;
create policy "customer revokes own hire"
  on wavex_os.hired_expert_agents for update
  using (
    auth.uid() = (
      select user_id from wavex_os.subscriptions
      where id = hired_expert_agents.subscription_id
    )
    and status = 'active'
  )
  with check (status = 'revoked');

-- digest_access_log: customer reads own audit log.
drop policy if exists "customer reads own audit log" on wavex_os.digest_access_log;
create policy "customer reads own audit log"
  on wavex_os.digest_access_log for select
  using (
    auth.uid() = (
      select s.user_id
      from wavex_os.hired_expert_agents hea
      join wavex_os.subscriptions s on s.id = hea.subscription_id
      where hea.id = digest_access_log.hired_agent_id
    )
  );

-- ─── Helper: list_hires_with_catalog ─────────────────────────────────
-- Returns the customer's hired agents joined to catalog metadata.
-- Used by the Mission Control Privacy Panel and the pricing page's
-- "manage my hires" view.
create or replace function public.wavex_os_list_my_hires()
returns table (
  hire_id              uuid,
  catalog_id           text,
  display_name         text,
  purpose              text,
  data_scope           text[],
  status               text,
  hired_at             timestamptz,
  required_tier        text,
  daily_token_cap      int
)
language sql
security definer
set search_path = ''
as $$
  select
    h.id as hire_id,
    h.catalog_id,
    c.display_name,
    c.purpose,
    c.data_scope,
    h.status,
    h.hired_at,
    c.required_tier,
    c.daily_token_cap
  from wavex_os.hired_expert_agents h
  join wavex_os.expert_agent_catalog c on c.id = h.catalog_id
  where h.subscription_id in (
    select id from wavex_os.subscriptions where user_id = auth.uid()
  )
  order by h.hired_at desc;
$$;

grant execute on function public.wavex_os_list_my_hires() to authenticated;
