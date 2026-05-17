-- Read-side RPC for customer-side manifest restore.
--
-- The companion table wavex_os.company_manifests has RLS policies that
-- allow customers to SELECT their own row, BUT the wavex_os schema is
-- NOT exposed via PostgREST (db-schemas config). So authenticated
-- clients can't query it directly. This RPC lives in `public` and runs
-- as SECURITY DEFINER, but filters by auth.uid() so the caller can only
-- see THEIR own manifests — the security boundary moves into the
-- function body instead of relying on table-level RLS exposure.
--
-- Use case: bootstrap on a fresh customer machine. The customer pairs
-- (device JWT now carries their auth.uid()), the bootstrap calls this
-- RPC, and any existing company manifests come back so we can restore
-- them to local disk and skip re-onboarding.

create or replace function public.wavex_os_get_my_company_manifests()
returns table (
  id              uuid,
  company_id      text,
  manifest        jsonb,
  manifest_sha256 text,
  goal            jsonb,
  finalized_at    timestamptz,
  signed_at       timestamptz,
  synced_at       timestamptz,
  created_at      timestamptz,
  updated_at      timestamptz
)
language sql
security definer
set search_path to 'wavex_os', 'public'
as $function$
  select
    cm.id, cm.company_id, cm.manifest, cm.manifest_sha256, cm.goal,
    cm.finalized_at, cm.signed_at, cm.synced_at,
    cm.created_at, cm.updated_at
  from wavex_os.company_manifests cm
  where cm.user_id = auth.uid()
  order by cm.synced_at desc
$function$;

-- Authenticated users only — never anon (which is unsigned), never
-- service_role (which uses the write RPC).
revoke all on function public.wavex_os_get_my_company_manifests() from public;
revoke all on function public.wavex_os_get_my_company_manifests() from anon;
revoke all on function public.wavex_os_get_my_company_manifests() from service_role;
grant execute on function public.wavex_os_get_my_company_manifests() to authenticated;

comment on function public.wavex_os_get_my_company_manifests() is
  'Customer-side manifest restore. Returns all company_manifests rows owned by the calling auth.uid(). Used by the wavex-os bootstrap stagePullManifest step to restore a customer on a fresh machine without re-running onboarding.';
