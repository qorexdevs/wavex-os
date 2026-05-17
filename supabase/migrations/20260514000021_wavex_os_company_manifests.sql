-- Cloud-resident store for finalized, signed onboarding company manifests.
-- Until now the manifest lived ONLY on the operator's local disk at
-- ~/.wavex-os/instances/default/companies/<companyId>/onboarding/company.manifest.json
-- which blocks any cross-device story. wavex-os-server's /activate route
-- best-effort upserts the manifest here after writing it to disk, via the
-- service-role SECURITY DEFINER RPC below (wavex_os is not REST-exposed).
-- One row per wavex-os company_id; mutable (re-activation after refinement
-- upserts cleanly).

create table wavex_os.company_manifests (
  id                uuid primary key default gen_random_uuid(),
  company_id        text not null unique,             -- the wavex-os company id
  user_id           uuid references auth.users(id) on delete set null,  -- owner, if resolvable
  manifest          jsonb not null,                   -- the full signed manifest
  manifest_sha256   text,                             -- signatures.manifest_hash
  goal              jsonb,                            -- extracted manifest.goal: kpiId/current/target/days
  finalized_at      timestamptz,
  signed_at         timestamptz,
  synced_at         timestamptz not null default now(),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

comment on table wavex_os.company_manifests is
  'Cloud-resident store for finalized, signed onboarding company manifests. One row per wavex-os company_id; the wavex-os-server /activate route best-effort upserts via wavex_os_record_company_manifest after writing the manifest to local disk. goal is the extracted manifest.goal for quick query without parsing the full jsonb.';

create index company_manifests_user_idx on wavex_os.company_manifests (user_id);
create index company_manifests_synced_idx on wavex_os.company_manifests (synced_at desc);

alter table wavex_os.company_manifests enable row level security;

-- Customer reads their own company's manifest (when user_id is resolvable).
create policy "customer reads own company manifest"
  on wavex_os.company_manifests for select
  using (user_id = auth.uid());

-- Operator console: admins read every company's manifest.
create policy "operator reads all company manifests"
  on wavex_os.company_manifests for select
  using (public.has_role(auth.uid(), 'admin'::public.app_role));

-- Write path: service-role SECURITY DEFINER RPC. wavex_os is not exposed via
-- PostgREST, so the wavex-os-server upserts through this `public`-schema RPC
-- keyed on company_id. Idempotent: re-activation after a refinement upserts.
create or replace function public.wavex_os_record_company_manifest(
  p_company_id text,
  p_manifest jsonb,
  p_user_id uuid default null,
  p_manifest_sha256 text default null,
  p_goal jsonb default null,
  p_finalized_at timestamptz default null,
  p_signed_at timestamptz default null
)
returns table(id uuid, company_id text, synced_at timestamptz)
language plpgsql
security definer
set search_path to 'wavex_os', 'public'
as $function$
declare
  v_row wavex_os.company_manifests%rowtype;
begin
  insert into wavex_os.company_manifests (
    company_id, user_id, manifest, manifest_sha256, goal,
    finalized_at, signed_at, synced_at
  ) values (
    p_company_id, p_user_id, p_manifest, p_manifest_sha256, p_goal,
    p_finalized_at, p_signed_at, now()
  )
  on conflict (company_id) do update set
    user_id         = coalesce(excluded.user_id, wavex_os.company_manifests.user_id),
    manifest        = excluded.manifest,
    manifest_sha256 = coalesce(excluded.manifest_sha256, wavex_os.company_manifests.manifest_sha256),
    goal            = coalesce(excluded.goal, wavex_os.company_manifests.goal),
    finalized_at    = coalesce(excluded.finalized_at, wavex_os.company_manifests.finalized_at),
    signed_at       = coalesce(excluded.signed_at, wavex_os.company_manifests.signed_at),
    synced_at       = now(),
    updated_at      = now()
  returning * into v_row;

  return query select v_row.id, v_row.company_id, v_row.synced_at;
end;
$function$;

-- Service-role only — this is the server-side sync path. Never callable by
-- public/anon/authenticated clients.
revoke all on function public.wavex_os_record_company_manifest(text, jsonb, uuid, text, jsonb, timestamptz, timestamptz) from public;
revoke all on function public.wavex_os_record_company_manifest(text, jsonb, uuid, text, jsonb, timestamptz, timestamptz) from anon;
revoke all on function public.wavex_os_record_company_manifest(text, jsonb, uuid, text, jsonb, timestamptz, timestamptz) from authenticated;
grant execute on function public.wavex_os_record_company_manifest(text, jsonb, uuid, text, jsonb, timestamptz, timestamptz) to service_role;
