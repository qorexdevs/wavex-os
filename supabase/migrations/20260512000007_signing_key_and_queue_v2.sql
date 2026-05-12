-- F.5.a — separate Ed25519 signing key per Expert Agent + signed injection queue.

alter table wavex_os.expert_agent_catalog
  add column if not exists signing_public_key bytea;

comment on column wavex_os.expert_agent_catalog.signing_public_key is
  'Ed25519 public key for verifying injections SIGNED by this catalog''s worker. Distinct from recipient_public_key (X25519, encryption). Liaison pins this on first hire.';

create table if not exists wavex_os.injection_queue_v2 (
  id                       uuid primary key default gen_random_uuid(),
  subscription_id          uuid not null references wavex_os.subscriptions(id) on delete cascade,
  hired_agent_id           uuid not null references wavex_os.hired_expert_agents(id) on delete cascade,
  catalog_id               text not null references wavex_os.expert_agent_catalog(id),
  kind                     text not null,
  payload                  jsonb not null,
  issued_by_catalog_id     text not null,
  issued_at                timestamptz not null default now(),
  signature_b64            text not null,
  consumed_at              timestamptz,
  consumed_by_liaison_id   text,
  expires_at               timestamptz not null default (now() + interval '72 hours'),
  created_at               timestamptz not null default now()
);

create index if not exists injection_queue_v2_sub_pending_idx
  on wavex_os.injection_queue_v2(subscription_id, created_at)
  where consumed_at is null;

alter table wavex_os.injection_queue_v2 enable row level security;

drop policy if exists "customer reads own queue v2" on wavex_os.injection_queue_v2;
create policy "customer reads own queue v2"
  on wavex_os.injection_queue_v2 for select
  using (
    auth.uid() = (
      select user_id from wavex_os.subscriptions
      where id = injection_queue_v2.subscription_id
    )
  );

drop policy if exists "customer marks own queue v2 consumed" on wavex_os.injection_queue_v2;
create policy "customer marks own queue v2 consumed"
  on wavex_os.injection_queue_v2 for update
  using (
    auth.uid() = (
      select user_id from wavex_os.subscriptions
      where id = injection_queue_v2.subscription_id
    )
    and consumed_at is null
  )
  with check (consumed_at is not null);

comment on table wavex_os.injection_queue_v2 is
  'Signed injection envelopes produced by F.5 server-side workers. Carries the Ed25519 signature the Liaison verifies before posting to local Paperclip.';
